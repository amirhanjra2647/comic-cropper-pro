import React, { useEffect, useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { fabric } from 'fabric';
import axios from 'axios';
import { Trash2, ZoomIn, ZoomOut, Download, Maximize, Undo2, Redo2, Sparkles, UserX, Info, ShieldCheck, Mail, ChevronLeft } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const PageLayout = ({ title, children }) => (
  <div style={styles.legalPage}>
    <Link to="/" style={styles.backLink}><ChevronLeft size={16}/> Back to Editor</Link>
    <h1 style={styles.legalTitle}>{title}</h1>
    <div style={styles.legalContent}>{children}</div>
  </div>
);

const Editor = ({ 
  canvas, setCanvas, previews, setPreviews, thresh, setThresh, zoom, setZoom, 
  enhance, setEnhance, isMasking, setIsMasking, handleUpload, runDetection, 
  resetZoom, handleZoomChange, undo, redo 
}) => {
  return (
    <div style={styles.editorContainer}>
      <div style={styles.adBanner}>
         <span style={styles.adLabel}>Advertisement</span>
         <div style={styles.adPlaceholder}>AdSense Horizontal Banner Slot</div>
      </div>
      <div style={styles.mainWorkArea}>
        <div style={styles.sidebar}>
          <label style={styles.sublabel}>Threshold: {thresh}</label>
          <input type="range" min="0" max="255" value={thresh} onChange={(e)=>setThresh(e.target.value)} onMouseUp={() => runDetection()} style={styles.range} />
          <div style={styles.sidebarAd}>
             <span style={styles.adLabel}>Advertisement</span>
             <div style={styles.adPlaceholderSmall}>AdSense Sidebar Slot</div>
          </div>
          <button onClick={() => { canvas.clear(); setPreviews([]); }} style={styles.btnSecondary}><Trash2 size={14}/> Clear</button>
        </div>
        <div id="editor-wrapper" style={styles.editorSpace}>
            <div style={styles.canvasWrapper}><canvas id="editor-canvas" /></div>
        </div>
        <div style={styles.gallery}>
          <h4 style={styles.label}>Crops ({previews.length})</h4>
          {previews.map((src, i) => (<div key={i} style={styles.card}><img src={src} style={{width:'100%'}} alt=""/><div style={styles.tag}>Panel {i+1}</div></div>))}
        </div>
      </div>
    </div>
  );
};

function App() {
  const [canvas, setCanvas] = useState(null);
  const [previews, setPreviews] = useState([]);
  const [thresh, setThresh] = useState(220);
  const [blur, setBlur] = useState(99);
  const [zoom, setZoom] = useState(0.5);
  const [enhance, setEnhance] = useState(false);
  const [isMasking, setIsMasking] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);

  const history = useRef([]);
  const redoStack = useRef([]);
  const isHistoryAction = useRef(false);

  useEffect(() => {
    const fCanvas = new fabric.Canvas('editor-canvas', {
      backgroundColor: '#1a1a1a',
      preserveObjectStacking: true,
      selection: true,
    });
    setCanvas(fCanvas);

    fabric.Object.prototype.set({
      transparentCorners: false,
      cornerColor: '#ffffff',
      cornerStrokeColor: '#3b82f6',
      cornerSize: 12,
      borderColor: '#3b82f6',
      borderScaleFactor: 2.5,
    });

    fabric.Object.prototype.controls.deleteControl = new fabric.Control({
      x: 0.5, y: -0.5, offsetY: 16, offsetX: -16,
      cursorStyle: 'pointer',
      mouseUpHandler: (e, transform) => {
        fCanvas.remove(transform.target);
        saveState(fCanvas);
        updatePreviews(fCanvas);
        return true;
      },
      render: (ctx, left, top) => {
        ctx.save(); ctx.translate(left, top);
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 2 * Math.PI); ctx.fill();
        ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); ctx.stroke();
        ctx.restore();
      }
    });

    let isDrawing = false;
    let rect;

    fCanvas.on('mouse:down', (opt) => {
      if (!opt.target) { 
        isDrawing = true;
        const pointer = fCanvas.getPointer(opt.e);
        rect = new fabric.Rect({
          left: pointer.x, top: pointer.y, width: 0, height: 0,
          fill: isMasking ? '#ffffff' : 'rgba(59, 130, 246, 0.3)', 
          stroke: isMasking ? '#ffffff' : '#3b82f6', 
          strokeWidth: isMasking ? 0 : 4,
          data: { type: isMasking ? 'mask' : 'crop' }
        });
        fCanvas.add(rect);
      }
    });

    fCanvas.on('mouse:move', (opt) => {
      if (!isDrawing) return;
      const pointer = fCanvas.getPointer(opt.e);
      rect.set({ width: Math.abs(pointer.x - rect.left), height: Math.abs(pointer.y - rect.top) });
      fCanvas.renderAll();
    });

    fCanvas.on('mouse:up', () => {
      if (isDrawing) {
        isDrawing = false;
        fCanvas.setActiveObject(rect);
        saveState(fCanvas);
        updatePreviews(fCanvas);
      }
    });

    fCanvas.on('object:modified', () => { saveState(fCanvas); updatePreviews(fCanvas); });
    
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      fCanvas.dispose();
    };
  }, [isMasking]);

  const handleZoomChange = (newZoom) => {
    const limitedZoom = Math.min(Math.max(0.05, newZoom), 4);
    setZoom(limitedZoom);
    if (canvas) {
      canvas.setZoom(limitedZoom);
      canvas.setWidth(canvas.backgroundImage.width * limitedZoom);
      canvas.setHeight(canvas.backgroundImage.height * limitedZoom);
      canvas.requestRenderAll();
    }
  };

  const resetZoom = () => {
    if (!canvas || !canvas.backgroundImage) return;
    const editor = document.getElementById('editor-wrapper');
    const scale = Math.min((editor.clientWidth - 40) / canvas.backgroundImage.width, (editor.clientHeight - 40) / canvas.backgroundImage.height);
    handleZoomChange(scale);
  };

  const updatePreviews = (fCanvas) => {
    if (!fCanvas) return;
    const allRects = fCanvas.getObjects('rect');
    const crops = allRects.filter(r => r.data?.type === 'crop').sort((a, b) => (a.top - b.top) || (a.left - b.left));

    allRects.forEach(r => {
      r.set({ strokeWidth: 0, hasControls: false, hasBorders: false, fill: r.data?.type === 'mask' ? '#ffffff' : 'transparent' });
    });
    fCanvas.renderAll();

    const cleanData = crops.map(r => fCanvas.toDataURL({
      left: r.left * fCanvas.getZoom(), top: r.top * fCanvas.getZoom(), 
      width: r.width * r.scaleX * fCanvas.getZoom(), height: r.height * r.scaleY * fCanvas.getZoom(), format: 'png'
    }));

    allRects.forEach(r => {
      const isM = r.data?.type === 'mask';
      r.set({ strokeWidth: isM ? 0 : 4, hasControls: true, hasBorders: true, fill: isM ? '#ffffff' : 'rgba(59, 130, 246, 0.3)', stroke: isM ? '#ffffff' : '#3b82f6' });
    });
    fCanvas.renderAll();
    setPreviews(cleanData);
  };

  const saveState = (fCanvas) => {
    if (isHistoryAction.current) return;
    history.current.push(JSON.stringify(fCanvas.getObjects('rect')));
    redoStack.current = [];
  };

  const undo = () => {
    if (history.current.length <= 1) return;
    isHistoryAction.current = true;
    redoStack.current.push(history.current.pop());
    applyState(history.current[history.current.length - 1]);
  };

  const redo = () => {
    if (!redoStack.current.length) return;
    isHistoryAction.current = true;
    const next = redoStack.current.pop();
    history.current.push(next);
    applyState(next);
  };

  const applyState = (json) => {
    canvas.getObjects('rect').forEach(obj => canvas.remove(obj));
    fabric.util.enlivenObjects(JSON.parse(json), (objs) => {
      objs.forEach(obj => canvas.add(obj));
      canvas.renderAll();
      updatePreviews(canvas);
      isHistoryAction.current = false;
    });
  };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // CLEAR PREVIOUS STATE
    if (canvas) {
      canvas.clear(); // Wipe the canvas
      setPreviews([]); // Clear sidebar crops
      history.current = []; // Reset Undo history
      redoStack.current = []; // Reset Redo history
    }

    setCurrentFile(file);
    const reader = new FileReader();
    reader.onload = (f) => {
      fabric.Image.fromURL(f.target.result, (img) => {
        canvas.setBackgroundImage(img, () => {
          resetZoom();
          runDetection(file);
        });
      });
    };
    reader.readAsDataURL(file);
  };

  const runDetection = async (file) => {
    const formData = new FormData();
    formData.append('file', file || currentFile);
    formData.append('thresh', thresh);
    formData.append('blur', blur);
    formData.append('enhance', enhance);
    try {
      const res = await axios.post('http://localhost:8000/detect', formData);
      canvas.getObjects('rect').filter(r => r.data?.type === 'crop').forEach(obj => canvas.remove(obj));
      res.data.panels.forEach(p => canvas.add(new fabric.Rect({ ...p, fill: 'rgba(59, 130, 246, 0.3)', stroke: '#3b82f6', strokeWidth: 4, data: {type: 'crop'} })));
      saveState(canvas);
      updatePreviews(canvas);
    } catch (e) { console.error(e); }
  };

  return (
    <Router>
      <div style={styles.appWrapper}>
        <nav style={styles.nav}>
          <Link to="/" style={{textDecoration:'none', display:'flex', alignItems:'center'}}>
            <h2 style={styles.logo}>✂️ AutoCropper Pro</h2>
          </Link>
          <div style={styles.toolbarCenter}>
            <button onClick={() => setEnhance(!enhance)} style={{...styles.btnToggle, color: enhance ? '#fbbf24' : '#666'}}><Sparkles size={16}/></button>
            <button onClick={() => setIsMasking(!isMasking)} style={{...styles.btnToggle, color: isMasking ? '#ef4444' : '#666'}}><UserX size={16}/></button>
            <div style={styles.controlGroup}>
               <button onClick={undo} style={styles.btnIcon}><Undo2 size={16}/></button>
               <button onClick={redo} style={styles.btnIcon}><Redo2 size={16}/></button>
            </div>
            <div style={styles.controlGroup}>
               <button onClick={() => handleZoomChange(zoom - 0.1)} style={styles.btnIcon}><ZoomOut size={16}/></button>
               <button onClick={() => handleZoomChange(zoom + 0.1)} style={styles.btnIcon}><ZoomIn size={16}/></button>
               <button onClick={resetZoom} style={{...styles.btnIcon, color:'#3b82f6'}}><Maximize size={16}/></button>
            </div>
          </div>
          <div style={{display:'flex', gap:'10px'}}>
             <input type="file" id="file-upload" onChange={handleUpload} style={{display:'none'}}/>
             <label htmlFor="file-upload" style={styles.btnSecondary}>Upload</label>
             <button onClick={async () => {
                const zip = new JSZip();
                previews.forEach((s, i) => zip.file(`p${i+1}.png`, s.split(',')[1], {base64: true}));
                saveAs(await zip.generateAsync({type:"blob"}), "panels.zip");
             }} style={styles.btnPrimary}><Download size={18}/></button>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={
            <Editor 
              canvas={canvas} previews={previews} setPreviews={setPreviews}
              thresh={thresh} setThresh={setThresh} zoom={zoom} setZoom={setZoom}
              enhance={enhance} setEnhance={setEnhance} isMasking={isMasking}
              setIsMasking={setIsMasking} handleUpload={handleUpload}
              runDetection={runDetection} resetZoom={resetZoom} handleZoomChange={handleZoomChange}
              undo={undo} redo={redo}
            />
          } />
          <Route path="/about" element={<PageLayout title="About AutoCropper Pro"><p>Professional comic extraction tool powered by AI.</p></PageLayout>} />
          <Route path="/privacy" element={<PageLayout title="Privacy Policy"><p>Privacy is priority. No images stored.</p></PageLayout>} />
          <Route path="/contact" element={<PageLayout title="Contact Us"><p>Support: <strong>babar@clioshipping.ae</strong></p></PageLayout>} />
        </Routes>
        <footer style={styles.footer}>
          <div style={styles.footerLinks}>
            <Link to="/about" style={styles.footerLink}><Info size={14}/> About</Link>
            <Link to="/privacy" style={styles.footerLink}><ShieldCheck size={14}/> Privacy</Link>
            <Link to="/contact" style={styles.footerLink}><Mail size={14}/> Contact</Link>
          </div>
          <p style={styles.copyright}>© 2026 AutoCropper Pro.</p>
        </footer>
      </div>
    </Router>
  );
}

const styles = {
  appWrapper: { display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#121212', color: 'white', fontFamily: 'sans-serif' },
  nav: { height: '60px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#1a1a1a', flexShrink: 0 },
  logo: { margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#3b82f6' },
  toolbarCenter: { display: 'flex', alignItems: 'center', gap: '10px' },
  controlGroup: { display:'flex', alignItems:'center', gap: '5px', background:'#252525', padding:'4px 10px', borderRadius:'6px', border:'1px solid #444' },
  btnToggle: { background: 'transparent', border: '1px solid #444', borderRadius: '6px', padding: '6px', cursor: 'pointer' },
  btnPrimary: { background: '#2563eb', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  btnSecondary: { background: '#333', color: 'white', border: '1px solid #444', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', display:'inline-block' },
  btnIcon: { background: 'transparent', color: 'white', border: 'none', cursor: 'pointer', padding: '4px' },
  editorContainer: { display:'flex', flexDirection:'column', flex: 1, overflow:'hidden' },
  adBanner: { height: '90px', background: '#0a0a0a', borderBottom: '1px solid #333', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  adLabel: { fontSize: '9px', color: '#444', marginBottom: '5px', textTransform: 'uppercase' },
  adPlaceholder: { width: 'min(728px, 90%)', height: '60px', border: '1px dashed #333', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' },
  mainWorkArea: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: { width: 'clamp(180px, 15vw, 220px)', background: '#1a1a1a', borderRight: '1px solid #333', padding: '15px', display: 'flex', flexDirection: 'column' },
  sidebarAd: { margin: '20px 0', textAlign: 'center' },
  adPlaceholderSmall: { width: '100%', height: '250px', border: '1px dashed #333', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' },
  editorSpace: { flex: 1, background: '#0a0a0a', overflow: 'auto', display: 'flex' },
  canvasWrapper: { margin: 'auto', boxShadow: '0 0 40px rgba(0,0,0,0.8)', backgroundColor: '#1a1a1a' },
  gallery: { width: 'clamp(120px, 20vw, 300px)', background: '#1a1a1a', borderLeft: '1px solid #333', overflowY: 'auto', padding: '15px' },
  card: { background: '#222', border: '1px solid #333', borderRadius: '4px', marginBottom: '12px', overflow: 'hidden', position:'relative' },
  tag: { position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(59, 130, 246, 0.8)', fontSize: '10px', padding: '4px', textAlign: 'center', fontWeight: 'bold' },
  sublabel: { fontSize: '11px', color: '#888', marginBottom: '5px' },
  range: { width: '100%', accentColor: '#3b82f6', marginBottom: '15px' },
  label: { fontSize: '11px', color: '#888', marginBottom: '10px' },
  footer: { height: '50px', background: '#1a1a1a', borderTop: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 },
  footerLinks: { display: 'flex', gap: '20px' },
  footerLink: { color: '#666', textDecoration: 'none', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' },
  copyright: { fontSize: '10px', color: '#444', margin: 0 },
  legalPage: { flex: 1, padding: '60px 20px', maxWidth: '800px', margin: 'auto', overflowY:'auto' },
  backLink: { color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '20px', textDecoration: 'none', fontSize:'14px' },
  legalTitle: { borderBottom: '1px solid #333', paddingBottom: '10px', fontSize:'28px' },
  legalContent: { color: '#aaa', marginTop: '20px', lineHeight: '1.8' }
};

export default App;