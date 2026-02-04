const handleBatchUpload = async (e) => {
  if (!isPro) return;
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  const zip = new JSZip();
  const mainFolder = zip.folder("Batch_Crops"); // ZIP ke andar folder banayen
  
  // UI feedback alert
  alert(`Processing ${files.length} images. Please don't close the tab...`);

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append('file', file);

      // Backend se panel detection hasil karen
      const res = await axios.post('https://comic-cropper-pro.onrender.com/detect', formData);
      const panels = res.data.panels;

      // Har image ke liye alag process (Hidden Canvas use karte hue)
      const tempCanvas = new fabric.Canvas(null, { width: 5000, height: 5000 });
      
      await new Promise((resolve) => {
        fabric.Image.fromURL(URL.createObjectURL(file), (img) => {
          tempCanvas.setBackgroundImage(img, () => {
            const fileFolder = mainFolder.folder(file.name.replace(/\.[^/.]+$/, "")); // Image ke naam ka folder
            
            panels.forEach((p, index) => {
              const dataUrl = tempCanvas.toDataURL({
                left: p.left,
                top: p.top,
                width: p.width,
                height: p.height,
                format: 'png',
                quality: 1
              });
              // ZIP mein file add karen
              fileFolder.file(`panel_${index + 1}.png`, dataUrl.split(',')[1], {base64: true});
            });
            resolve();
          });
        });
      });
    }

    // ZIP generate aur download karen
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "AutoCropper_Batch_Results.zip");
    alert("Batch Processing Complete! Your ZIP is ready.");

  } catch (err) {
    console.error("Batch Error:", err);
    alert("Something went wrong during batch processing.");
  }
};