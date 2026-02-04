import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { fabric } from 'fabric';
import axios from 'axios';
import { Trash2, ZoomIn, ZoomOut, Download, Maximize, ChevronLeft, RefreshCw, Star, Info } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const PageLayout = ({ title, children }) => (
  <div style={styles.legalPage}>
    <Link to="/" style={styles.backLink}><ChevronLeft size={16}/> Back to Editor</Link>
    <h1 style={styles.legalTitle}>{title}</h1>
    <div style={styles.legalContent}>{children}</div>
  </div>
);

const Editor = ({ canvas, previews, runDetection, resetZoom, handleZoomChange, isPro, handleBatchUpload, handleUpgrade }) => (
  <div style={styles.editorContainer}>
    <div style={styles.adBanner}><div style={styles.adPlaceholder}>AdSense Horizontal Banner Slot</div></div>
    <div style={styles.mainWorkArea}>
      <div style={styles.sidebar}>
        {/* 1. TOP: Primary Action Buttons */}
        <button onClick={() => runDetection()} style={styles.btnPrimary}>
          <RefreshCw size={14}/> Auto-Detect
        </button>

        <label style={{...styles.btnGold, opacity: isPro ? 1 : 0.7}}>
          <Star size={14} fill={isPro ? "black" : "none"}/> 
          {isPro ? "Batch Crop" : "Batch Crop (PRO)"}
          <input type="file" multiple hidden disabled={!isPro} onChange={handleBatchUpload} />
        </label>

        {/* 2. SECOND: Instructions Box (11px font) */}
        <div style={styles.infoBox}>
          <p style={styles.infoTitle}>🚀 How to Use</p>
          <div style={styles.infoText}>
            • <b>Upload</b> image to start.<br/>
            • Click <b>Auto-Detect</b>.<br/>
            • <b>Batch Crop</b> for multiple files (PRO).<br/>
            • <b>Adjust</b> yellow points.<br/>
            • <b>ZIP</b> to download results.
          </div>
        </div>
        
        <div style={{ flex: 1 }}></div>

        {/* 3. THIRD: Sidebar Ad Slot */}
        <div style={styles.sidebarAd}>
          <div style={styles.adPlaceholderSmall}>AdSense Sidebar Slot</div>
        </div>
        
        {/* 4. BOTTOM: Secondary Action Buttons */}
        {!isPro && (
          <button onClick={handleUpgrade} style={styles.btnUpgrade}>⭐ Upgrade to Pro</button>
        )}

        <button onClick={() => { canvas.getObjects('rect').forEach(o => canvas.remove(o)); canvas.renderAll(); }} style={styles.btnSecondary}>
          <Trash2 size={14}/> Clear All
        </button>
      </div>

      <div id="editor-wrapper" style={styles.editorSpace}><div style={styles.canvasWrapper}><canvas id="editor-canvas" /></div></div>
      
      <div style={styles.gallery}>
        <h4 style={styles.label}>Captured ({previews.length})</h4>
        {previews.map((src, i) => (<div key={i} style={styles.card}><img src={src} style={{width:'100%'}} alt=""/></div>))}
      </div>
    </div>
  </div>
);

function App() {
  const [canvas, setCanvas] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [zoom, setZoom] = useState(0.5);
  const [currentFile, setCurrentFile] = useState(null);
  const [isPro, setIsPro] = useState(false); //

  const boxStyle = {
    fill: 'rgba(59, 130, 246, 0.1)',
    stroke: '#3b82f6',
    strokeWidth: 6,
    cornerColor: '#facc15',
    cornerStrokeColor: '#000000',
    cornerSize: 15,
    transparentCorners: false,
    data: {type: 'crop'}
  };

  // Paddle Setup for Pakistan Automation
  useEffect(() => {
    if (window.Paddle) {
      window.Paddle.Setup({ vendor: 12345 }); // Replace with your Vendor ID
    }
  }, []);

  const handleUpgrade = () => {
    window.Paddle.Checkout.open({
      product: 67890, // Replace with your Price ID
      successCallback: (data) => {
        setIsPro(true);
        alert("Mubarak ho! Batch features unlock ho gaye hain.");
      }
    });
  };

  // Batch Logic for ZIP Results
  const handleBatchUpload = async (e) => {
    if (!isPro) return;
    const files = Array.from(e.target.files);
    const zip = new JSZip();
    alert(`Processing ${files.length} images...`);

    try {
      for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post('https://comic-cropper-pro.onrender.com/detect', formData);
        zip.file(`${file.name}_result.txt`, "Detection metadata processed"); // Simplified for demo
      }
      const content = await zip.generateAsync({type:"blob"});
      saveAs(content, "AutoCropper_Batch.zip");
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const fCanvas = new fabric.Canvas('editor-canvas', { backgroundColor: '#1a1a1a', preserveObjectStacking: true });
    setCanvas(fCanvas);

    fabric.Object.prototype.controls.deleteControl = new fabric.Control({
      x: 0.5, y: -0.5, offsetY: 16, offsetX: -16, cursorStyle: 'pointer',
      mouseUpHandler: (e, transform) => {
        fCanvas.remove(transform.target);
        updatePreviews(fCanvas);
        return true;
      },
      render: (ctx, left, top) => {
        const size = 24;
        ctx.save(); ctx.translate(left, top);
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, size/2, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); ctx.stroke();
        ctx.restore();
      }
    });

    fCanvas.on('mouse:down', (opt) => {
      if (!opt.target) {
        const p = fCanvas.getPointer(opt.e);
        const rect = new fabric.Rect({ left: p.x, top: p.y, width: 0, height: 0, ...boxStyle });
        fCanvas.add(rect);
        fCanvas.on('mouse:move', (m) => {
          const p2 = fCanvas.getPointer(m.e);
          rect.set({ width: Math.abs(p2.x - rect.left), height: Math.abs(p2.y - rect.top) });
          fCanvas.renderAll();
        });
        fCanvas.on('mouse:up', () => { fCanvas.off('mouse:move'); updatePreviews(fCanvas); });
      }
    });
    return () => fCanvas.dispose();
  }, []);

  const handleZoomChange = (newZoom) => {
    const limited = Math.min(Math.max(0.001, newZoom), 4);
    setZoom(limited);
    if (canvas && canvas.backgroundImage) {
      canvas.setZoom(limited);
      canvas.setWidth(canvas.backgroundImage.width * limited);
      canvas.setHeight(canvas.backgroundImage.height * limited);
      canvas.requestRenderAll();
    }
  };

  const resetZoom = () => {
    const wrapper = document.getElementById('editor-wrapper');
    if (!canvas || !wrapper || !canvas.backgroundImage) return;
    const padding = 40;
    const bestScale = Math.min((wrapper.clientWidth - padding) / canvas.backgroundImage.width, (wrapper.clientHeight - padding) / canvas.backgroundImage.height);
    handleZoomChange(bestScale);
  };

  const updatePreviews = (fCanvas) => {
    const crops = fCanvas.getObjects('rect').filter(r => r.data?.type === 'crop').sort((a, b) => a.top - b.top);
    crops.forEach(r => { r.opacity = 0; });
    fCanvas.renderAll();
    const newPreviews = crops.map(r => fCanvas.toDataURL({ 
        left: r.left * fCanvas.getZoom(), 
        top: r.top * fCanvas.getZoom(), 
        width: r.width * r.scaleX * fCanvas.getZoom(), 
        height: r.height * r.scaleY * fCanvas.getZoom(),
        format: 'png', multiplier: 1 / fCanvas.getZoom() 
    }));
    crops.forEach(r => { r.opacity = 1; });
    fCanvas.renderAll();
    setPreviews(newPreviews);
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    canvas.clear(); setPreviews([]); setCurrentFile(file);
    const reader = new FileReader();
    reader.onload = (f) => fabric.Image.fromURL(f.target.result, (img) => {
      canvas.setBackgroundImage(img, () => { resetZoom(); runDetection(file); });
    });
    reader.readAsDataURL(file);
  };

  const runDetection = async (file) => {
    const formData = new FormData();
    formData.append('file', file || currentFile);
    try {
      const res = await axios.post('https://comic-cropper-pro.onrender.com/detect', formData);
      canvas.getObjects('rect').filter(o => o.data?.type === 'crop').forEach(o => canvas.remove(o));
      res.data.panels.forEach(p => canvas.add(new fabric.Rect({ ...p, ...boxStyle })));
      updatePreviews(canvas);
    } catch (err) { console.error("Detection Error:", err); }
  };

  return (
    <Router>
      <div style={styles.app}>
        <nav style={styles.nav}>
          <Link to="/" style={{textDecoration:'none'}}><h2 style={{color:'#3b82f6', margin:0}}>✂️ AutoCropper Pro</h2></Link>
          <div style={styles.tools}>
            <div style={styles.zoomGroup}>
              <button onClick={() => handleZoomChange(zoom - 0.05)} style={styles.btnIcon}><ZoomOut size={16}/></button>
              <button onClick={() => handleZoomChange(zoom + 0.05)} style={styles.btnIcon}><ZoomIn size={16}/></button>
              <button onClick={resetZoom} style={{...styles.btnIcon, color:'#3b82f6'}}><Maximize size={16}/></button>
            </div>
            <input type="file" id="up" onChange={handleUpload} style={{display:'none'}}/>
            <label htmlFor="up" style={styles.btnSecondary}>Upload</label>
            <button onClick={async () => {
              const zip = new JSZip();
              previews.forEach((s, i) => zip.file(`p${i+1}.png`, s.split(',')[1], {base64: true}));
              saveAs(await zip.generateAsync({type:"blob"}), "panels.zip");
            }} style={styles.btnPrimary}><Download size={16}/> ZIP</button>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Editor canvas={canvas} previews={previews} runDetection={runDetection} resetZoom={resetZoom} handleZoomChange={handleZoomChange} isPro={isPro} handleBatchUpload={handleBatchUpload} handleUpgrade={handleUpgrade} />} />
          <Route path="/about" element={<PageLayout title="About Us">Digital comic automation engine.</PageLayout>} />
          <Route path="/privacy" element={<PageLayout title="Privacy">No-logs policy architecture.</PageLayout>} />
        </Routes>

        <footer style={styles.footer}>
          <div style={styles.footerLinks}>
            <Link to="/about" style={styles.footerLink}>About</Link>
            <Link to="/privacy" style={styles.footerLink}>Privacy</Link>
          </div>
          <p style={styles.copyright}>© 2026 AutoCropper Pro.</p>
        </footer>
      </div>
    </Router>
  );
}

const styles = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#121212', color: 'white', fontFamily: 'sans-serif' },
  nav: { height: '60px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a1a', borderBottom: '1px solid #333' },
  tools: { display: 'flex', gap: '12px', alignItems:'center' },
  zoomGroup: { display:'flex', gap:'5px', background:'#222', padding:'4px', borderRadius:'6px', border:'1px solid #444' },
  editorContainer: { display:'flex', flexDirection:'column', flex: 1, overflow:'hidden' },
  mainWorkArea: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: { width: '220px', background: '#1a1a1a', borderRight: '1px solid #333', padding: '15px', display: 'flex', flexDirection: 'column', gap:'10px' },
  editorSpace: { flex: 1, background: '#0a0a0a', overflow: 'auto', display: 'flex' },
  canvasWrapper: { margin: 'auto', boxShadow: '0 0 40px rgba(0,0,0,0.8)', backgroundColor: '#1a1a1a' },
  gallery: { width: '300px', background: '#1a1a1a', padding: '20px', overflowY: 'auto', borderLeft: '1px solid #333' },
  card: { background: '#222', borderRadius: '4px', marginBottom: '10px', overflow: 'hidden', border: '1px solid #444' },
  btnPrimary: { background: '#2563eb', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display:'flex', alignItems:'center', gap:'8px', width:'100%', justifyContent:'center' },
  btnGold: { background: '#facc15', color: 'black', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display:'flex', alignItems:'center', gap:'8px', width:'100%', justifyContent:'center', marginTop:'5px' },
  btnUpgrade: { background: 'transparent', color: '#facc15', border: '1px solid #facc15', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginBottom:'10px' },
  btnSecondary: { background: '#333', color: 'white', border: '1px solid #444', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontSize:'12px', display:'flex', alignItems:'center', gap:'5px', justifyContent:'center' },
  btnIcon: { background:'transparent', color:'white', border:'none', cursor:'pointer', padding:'4px' },
  infoBox: { background: '#1e3a8a22', padding: '12px', borderRadius: '8px', border: '1px solid #1e3a8a44', marginTop:'10px' },
  infoTitle: { margin:0, fontSize:'11px', color:'#3b82f6', fontWeight:'bold' },
  infoText: { marginTop:'5px', fontSize:'11px', color:'#aaa', lineHeight:'1.4' },
  adBanner: { height: '70px', background: '#0a0a0a', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  adPlaceholder: { width: '728px', height: '50px', border: '1px dashed #333', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' },
  sidebarAd: { marginTop: 'auto', marginBottom: '10px', width:'100%', height:'200px', border:'1px dashed #333', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'#333' },
  footer: { height: '40px', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderTop: '1px solid #333', fontSize:'10px' },
  footerLinks: { display: 'flex', gap: '15px' },
  footerLink: { color: '#666', textDecoration: 'none' },
  copyright: { color: '#444', margin: 0 },
  label: { fontSize: '11px', color: '#888', marginBottom: '10px' },
  legalPage: { flex: 1, padding: '60px 20px', maxWidth: '800px', margin: 'auto', overflowY:'auto' },
  backLink: { color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', textDecoration: 'none', fontSize:'14px' },
  legalTitle: { borderBottom: '1px solid #333', paddingBottom: '10px', fontSize:'28px' },
  legalContent: { color: '#aaa', marginTop: '20px', lineHeight: '1.8' }
};

export default App;