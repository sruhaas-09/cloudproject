
function triggerUpload() {
  document.getElementById("uploadInput").click();
}

async function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/upload", {
      method: "POST",
      body: formData,
      credentials: 'include' 
    });

    const text = await res.text();
    alert(text);
    await loadFiles(); 
  } catch (err) {
    console.error("Upload failed:", err);
    alert("Failed to upload file");
  }
}

function goToTask() {
  window.location.href = "taskspage.html";
}

function goToDiary() {
  window.location.href = "diarypage.html";
}

function toggleShareOptions() {
  const shareDiv = document.getElementById("shareOptions");
  const isHidden = shareDiv.style.display === "none" || shareDiv.style.display === "";
  shareDiv.style.display = isHidden ? "flex" : "none";
}

let currentPage = 1;
const filesPerPage = 12;
let allFiles = [];
let filteredFiles = [];

async function loadFiles() {
  try {
    const res = await fetch("/files");
    if (!res.ok) {
      console.error("Error fetching files", await res.text());
      return;
    }

    allFiles = await res.json();
    filteredFiles = [...allFiles];
    renderFiles();
  } catch (err) {
    console.error("Error loading files", err);
  }
}

function renderFiles(files = filteredFiles) {
  const middle = document.getElementById("middle");
  middle.innerHTML = "";

  const cardsPerRow = 3;
  const filesPerPage = 6; 
  const totalPages = Math.ceil(files.length / filesPerPage);
  const start = (currentPage - 1) * filesPerPage;
  const end = start + filesPerPage;
  const pageFiles = files.slice(start, end);

  const rowContainer = document.createElement("div");
  rowContainer.className = "container";

  for (let i = 0; i < pageFiles.length; i += cardsPerRow) {
    const row = document.createElement("div");
    // row.style.gap = "20px"; 
    // row.style.marginTop = "1px"; 
    row.className = "row g-4"; 

    

    const rowFiles = pageFiles.slice(i, i + cardsPerRow);

    rowFiles.forEach((file) => {
      const wrapper = document.createElement("div");
      wrapper.className = "col-md-4 d-flex"; 
      wrapper.style.minHeight = "250px";

      const card = document.createElement("div");
      card.className = "card shadow-lg border-0 rounded-4 flex-fill"; 

      const topBar = document.createElement("div");
      topBar.className = "d-flex justify-content-end align-items-center px-3 pt-2 gap-1";

      const starBtn = document.createElement("button");
      starBtn.className = "btn btn-sm btn-outline-warning rounded-circle";
      starBtn.innerHTML = `<i class="bi bi-star${file.starred ? "-fill" : ""}"></i>`;
      starBtn.style.marginBottom="1px";
      starBtn.onclick = (e) => {
        e.stopPropagation();
        file.starred = !file.starred;
        renderFiles(filteredFiles);
      };

      const personalBtn = document.createElement("button");
      personalBtn.className = "btn btn-sm btn-outline-secondary rounded-circle";
      personalBtn.innerHTML = `<i class="bi bi-person"></i>`;
      personalBtn.style.marginBottom="1px";

      topBar.appendChild(starBtn);
      topBar.appendChild(personalBtn);

      const iconBox = document.createElement("div");
      iconBox.className = "p-4 text-white text-center fs-1 rounded-top";
      iconBox.style.background = "linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)";
      iconBox.style.cursor = "pointer";

      if (file.mimetype.startsWith("image/")) iconBox.innerHTML = `<i class="bi bi-image"></i>`;
      else if (file.mimetype === "application/pdf") iconBox.innerHTML = `<i class="bi bi-file-earmark-pdf"></i>`;
      else if (file.mimetype.includes("word")) iconBox.innerHTML = `<i class="bi bi-file-earmark-word"></i>`;
      else iconBox.innerHTML = `<i class="bi bi-file-earmark"></i>`;

      iconBox.onclick = () => openFileViewer(file);

      const body = document.createElement("div");
      body.className = "card-body text-center d-flex flex-column justify-content-between";

      const title = document.createElement("h6");
      title.className = "card-title text-truncate";
      title.textContent = file.filename;

      const dateInfo = document.createElement("p");
      dateInfo.className = "text-muted small mb-2";
      dateInfo.textContent = `📅 ${new Date(file.upload_time).toLocaleDateString()}`;

      const downloadBtn = document.createElement("button");
      downloadBtn.className = "btn btn-primary btn-sm mt-auto";
      downloadBtn.innerHTML = `<i class="bi bi-download"></i> Download`;
      downloadBtn.onclick = async () => {
        const res = await fetch(`/uploads/${file.filename}`);
        const blob = await res.blob();
        console.log(blob);
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = file.filename;
        link.click();
      };

      body.appendChild(title);
      body.appendChild(dateInfo);
      body.appendChild(downloadBtn);

      card.appendChild(topBar);
      card.appendChild(iconBox);
      card.appendChild(body);
      wrapper.style.marginBottom="10px";
      wrapper.appendChild(card);
      row.appendChild(wrapper);
    });

    rowContainer.appendChild(row);
  }

  middle.appendChild(rowContainer);

let pagination = document.getElementById("paginationWrapper");
if (!pagination) {
  pagination = document.createElement("div");
  pagination.id = "paginationWrapper";

  pagination.style.width = "300px"; 
  pagination.style.height = "40px"; 
  pagination.style.margin = "0px auto"; 
  pagination.style.display = "flex";
  pagination.style.justifyContent = "space-between";
  pagination.style.alignItems = "center"; 
  pagination.style.gap="5px";
  pagination.style.flexWrap = "nowrap"; 
  middle.appendChild(pagination);
}
pagination.innerHTML = "";

if (files.length > 0) {
  const totalPages = Math.ceil(files.length / filesPerPage);

  const prevBtn = document.createElement("button");
  prevBtn.className = "btn btn-outline-secondary btn-sm";
  prevBtn.textContent = "⬅️ Prev";
  prevBtn.disabled = currentPage === 1;
  prevBtn.style.flex = "1"; 
  prevBtn.style.height = "30px"; 
  prevBtn.onclick = () => {
    currentPage--;
    renderFiles(files);
  };

  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-outline-secondary btn-sm";
  nextBtn.textContent = "Next ➡️";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.style.flex = "1";
  nextBtn.style.height = "30px"; 
  nextBtn.onclick = () => {
    currentPage++;
    renderFiles(files);
  };

  pagination.appendChild(prevBtn);
  pagination.appendChild(nextBtn);
} else {
  pagination.style.display = "none"; 
}


}






function openFileViewer(file) {
  const fileViewer = document.getElementById("fileViewer");
  const viewerContent = document.getElementById("viewerContent");

  viewerContent.innerHTML = "";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.id = "closeBtn";
  closeBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
  closeBtn.setAttribute("aria-label", "Close");

  closeBtn.onclick = () => closeViewer();

  viewerContent.appendChild(closeBtn);

  const fileUrl = `/uploads/${file.filename}`;

  if (file.mimetype.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = fileUrl;
    img.style.maxWidth = "90%";
    img.style.maxHeight = "90%";
    img.style.borderRadius = "8px";
    viewerContent.appendChild(img);
  } else if (file.mimetype === "application/pdf") {
    const iframe = document.createElement("iframe");
    iframe.src = fileUrl;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    viewerContent.appendChild(iframe);
  } else if (file.mimetype.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = fileUrl;
    video.controls = true;
    video.style.maxWidth = "90%";
    video.style.maxHeight = "90%";
    viewerContent.appendChild(video);
  } else if (file.mimetype.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.src = fileUrl;
    audio.controls = true;
    viewerContent.appendChild(audio);
  } else {
    const msg = document.createElement("div");
    msg.innerHTML =
      "Preview not available, please download and view. <br><small>(Sorry for inconvenience)</small>";
    msg.style.textAlign = "center";
    msg.style.padding = "20px";
    viewerContent.appendChild(msg);
  }

  fileViewer.style.display = "flex";
}


function closeViewer() {
  document.getElementById("fileViewer").style.display = "none";
}

window.onload = async () => {
  await loadFiles();

  const searchInput = document.getElementById('inputs');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      filteredFiles = allFiles.filter(file => file.filename.toLowerCase().includes(query));
      currentPage = 1;
      renderFiles(filteredFiles);
    });
  }
};
