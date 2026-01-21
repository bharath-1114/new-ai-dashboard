function hasUploadedData() {
    return localStorage.getItem("hasData") === "true";
  }
  
  document.addEventListener("hashchange", () => {
    const section = location.hash.replace("#", "");
  
    if (!hasUploadedData() && section !== "upload") {
      alert("Please upload a CSV file first.");
      location.hash = "upload";
    }
  });
  