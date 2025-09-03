const express = require('express');
const app = express();
const mysql = require('mysql2');
const bodyparser = require('body-parser');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieparser = require('cookie-parser');
const fs = require('fs');   

app.use(cookieparser());
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(bodyparser.urlencoded({ extended: true }));
app.use(bodyparser.json());
require('dotenv').config();

app.use("/uploads", express.static("uploads", {
  setHeaders: (res, path) => {
    if (path.endsWith(".pdf")) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline"); 
    }
  }
}));

app.use(express.static(path.join(__dirname, 'front_end')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'front_end', 'index.html'));
});

let sslConfig = undefined;

if (process.env.DB_SSL_CA) {
  if (process.env.DB_SSL_CA.includes("BEGIN CERTIFICATE")) {
    sslConfig = { ca: process.env.DB_SSL_CA };
  } else {
    sslConfig = { ca: fs.readFileSync(process.env.DB_SSL_CA, "utf8") };
  }
}

const pool = mysql.createPool({
  host: process.env.TIDB_HOST,
  user: process.env.TIDB_USER,
  port: process.env.TIDB_PORT,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE,
  ssl: process.env.TIDB_ENABLE_SSL === "true" ? {} : null,
});


// console.log("Using SSL CA:", process.env.DB_SSL_CA);

const secret_key = process.env.SECRET_KEY || 'fallback_secret';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, process.env.UPLOAD_PATH));
  },
  filename: (req, file, cb) => {
    cb(null,Date.now()+"-"+ file.originalname);
  }
});

const upload = multer({ storage });

function authenticatetoken(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) return res.status(401).send('access token missing');
  jwt.verify(token, secret_key, (err, user) => {
    if (err) return res.status(403).send('token invalid or expired');
    req.userid = user.id;
    next();
  });
}

app.post('/signup', async (req, res) => {
  const { email, user_name, phone_number, password_entery, password_confrim } = req.body;

  if (password_entery !== password_confrim) {
    return res.status(400).send('passwords do not match');
  }

  try {
    const hashedpassword = await bcrypt.hash(password_entery, 10);
    const insertquery = `INSERT INTO sign_up (email, user_name, phone_number, password_entery, password_confrim) VALUES (?, ?, ?, ?, ?)`;
    pool.query(
      insertquery,
      [email, user_name, phone_number, hashedpassword, hashedpassword],
      (err) => {
        if (err) {
          console.error('insert error:', err);
          return res.status(500).send(err);
        }
        res.status(201).redirect('/loginpage.html');
      }
    );
  } catch (error) {
    res.status(500).send('server error');
  }
});

app.post('/login', (req, res) => {
  const { email, password_entery } = req.body;

  pool.query(`SELECT * FROM sign_up WHERE email = ?`, [email], async (err, results) => {
    if (err) return res.status(500).send('server error');
    if (results.length === 0) return res.status(401).send('invalid email or password');
    const user = results[0];
    const match = await bcrypt.compare(password_entery, user.password_entery);
    if (!match) return res.status(401).send('invalid email or password');

    const token = jwt.sign({ id: user.id, email: user.email }, secret_key, { expiresIn: '2h' });
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",  
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000
    });

    res.redirect('/mainpage.html');
  });
});

app.post('/upload', authenticatetoken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('no file uploaded');

  const { filename, mimetype, size } = req.file;
  const userid = req.userid;

  const sql = `INSERT INTO uploaded_files (user_id, filename, mimetype, size) VALUES (?, ?, ?, ?)`;
  pool.query(sql, [userid, filename, mimetype, size], (err) => {
    if (err) {
      console.error('db error:', err);
      return res.status(500).send('database error');
    }
    res.send('file uploaded successfully');
  });
});

app.get('/files', authenticatetoken, (req, res) => {
  const userid = req.userid;
  const sql = `SELECT id, filename, mimetype, upload_time FROM uploaded_files WHERE user_id = ?`;
  pool.query(sql, [userid], (err, results) => {
    if (err) {
      console.error('error fetching files:', err);
      return res.status(500).json({ error: 'db error' });
    }
    res.json(results);
  });
});

app.get('/files/:id', authenticatetoken, (req, res) => {
  const fileid = req.params.id;
  const userid = req.userid;

  const sql = `SELECT id, filename, mimetype FROM uploaded_files WHERE id = ? AND user_id = ?`;
  pool.query(sql, [fileid, userid], (err, results) => {
    if (err) {
      console.error("db error:", err);
      return res.status(500).send("database error");
    }
    if (results.length === 0) {
      return res.status(404).send("file not found");
    }

    const file = results[0];
    const absolutePath = path.join(__dirname, "uploads", file.filename);

    fs.access(absolutePath, fs.constants.F_OK, (err) => {
      if (err) {
        return res.status(404).send("file missing on server");
      }

      res.download(absolutePath, file.filename, (err) => {
        if (err) {
          console.error("download error:", err);
          res.status(500).send("could not download file");
        }
      });
    });
  });
});


app.post('/forgotpassword', async (req, res) => {
  const { email, phone_number, password_entery, password_confrim } = req.body;

  if (password_entery !== password_confrim) {
    return res.status(400).send('passwords do not match');
  }

  try {
    const checkquery = 'SELECT * FROM sign_up WHERE email = ? AND phone_number = ?';
    pool.query(checkquery, [email, phone_number], async (err, results) => {
      if (err) {
        console.error('db error:', err);
        return res.status(500).send('server error');
      }

      if (results.length === 0) {
        return res.status(404).send('email or phone number not found');
      }

      const hashedpassword = await bcrypt.hash(password_entery, 10);

      const updatequery = 'UPDATE sign_up SET password_entery = ?, password_confrim = ? WHERE email = ? AND phone_number = ?';
      pool.query(updatequery, [hashedpassword, hashedpassword, email, phone_number], (err, updateresult) => {
        if (err) {
          console.error('error updating password:', err);
          return res.status(500).send('could not update password');
        }
        if (updateresult.affectedRows === 0) {
          return res.status(400).send('password not updated');
        }
        res.send('password updated successfully');
      });
    });
  } catch (error) {
    console.error('error in forgotpassword:', error);
    res.status(500).send('server error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,'0.0.0.0', () => {
  console.log(`server running at ${PORT}`);
});
