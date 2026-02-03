import React, { useEffect, useState } from 'react'; // Removed unused useRef
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { fabric } from 'fabric';
import axios from 'axios';
import { Trash2, ZoomIn, ZoomOut, Download, Maximize, ChevronLeft, RefreshCw } from 'lucide-react'; // Removed unused icons
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Legal Page Layout for AdSense
const PageLayout = ({ title, children }) => (
  <div style={styles.legalPage}>
    <Link to="/" style={styles.backLink}><ChevronLeft size={16}/> Back to Editor</Link>
    <h1 style={styles.legalTitle}>{title}</h1>
    <div style={styles.legalContent}>{children}</div>
  </div>
);

const Editor = ({ canvas, previews, runDetection, resetZoom, handleZoomChange }) => (
  <div style={styles.editorContainer}>
    <div style={styles.adBanner}><div style={styles.adPlaceholder}>AdSense Horizontal Banner Slot</div></div>
    <div style={styles.mainWorkArea}>
      <div style={styles.sidebar}>
        {/* 1. TOP: Primary Action Button */}
        <button onClick={() => runDetection()} style={styles.btnPrimary}>
          <RefreshCw size={14}/> Auto-Detect
        </button>

        {/* 2. SECOND: Instructions Box */}
        <div style={{...styles.infoBox, marginTop: '10px', border: '1px solid #1e3a8a44'}}>
          <p style={{margin:0, fontSize:'11px', color:'#3b82f6', fontWeight:'bold'}}>🚀 How to Use</p>
          <div style={{marginTop:'5px', fontSize:'11px', color:'#aaa', lineHeight:'1.4'}}>
            • <b>Upload</b> image to start.<br/>
            • Click <b>Auto-Detect</b>.<br/>
            • <b>Adjust</b> yellow points.<br/>
            • <b>Delete</b> with red (X).<br/>
            • <b>ZIP</b> to download.
          </div>
        </div>
        
        {/* 3. FLEX SPACER: Pushes following items to bottom */}
        <div style={{ flex: 1 }}></div>

        {/* 4. THIRD: Sidebar Ad Slot */}
        <div style={styles.sidebarAd}>
          <div style={styles.adPlaceholderSmall}>AdSense Sidebar Slot</div>
        </div>
        
        {/* 5. BOTTOM: Secondary Action Button */}
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
  const crops = fCanvas.getObjects('rect')
    .filter(r => r.data?.type === 'crop')
    .sort((a, b) => a.top - b.top);

  const multiplier = 1 / fCanvas.getZoom();

  // 1. Hide the blue boxes before capturing
  crops.forEach(r => { r.opacity = 0; });
  fCanvas.renderAll();

  // 2. Capture the clean images
  const newPreviews = crops.map(r => fCanvas.toDataURL({ 
      left: r.left * fCanvas.getZoom(), 
      top: r.top * fCanvas.getZoom(), 
      width: r.width * r.scaleX * fCanvas.getZoom(), 
      height: r.height * r.scaleY * fCanvas.getZoom(),
      format: 'png',
      quality: 1,
      multiplier: multiplier 
  }));

  // 3. Show the blue boxes again for the editor
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
      // API Connection pointing to your Render backend
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
          <Link to="/" style={{textDecoration:'none'}}><h2 style={{color:'#3b82f6'}}>✂️ AutoCropper Pro</h2></Link>
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
          <Route path="/" element={<Editor canvas={canvas} previews={previews} runDetection={runDetection} resetZoom={resetZoom} handleZoomChange={handleZoomChange} />} />
          <Route path="/about" element={
  <PageLayout title="About Us">
    <p style={{marginBottom: '20px', color: '#fff', fontSize: '16px'}}>
      Welcome to <strong>AutoCropper Pro</strong>, the premier <strong>AI-powered Manhwa slicing tool</strong> engineered for digital comic creators and scanlation teams.
    </p>
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px', color: '#aaa'}}>
      <div>
        <strong style={{color: '#fff', display: 'block', marginBottom: '5px'}}>Automated Webtoon Slicing</strong>
        Our platform utilizes advanced <strong>image processing algorithms</strong> to eliminate the manual labor of cropping long-strip comics into individual, publication-ready panels.
      </div>
      <div>
        <strong style={{color: '#fff', display: 'block', marginBottom: '5px'}}>Sobel Energy Detection Engine</strong>
        Using our proprietary <strong>Sobel Energy Engine</strong>, the tool performs a deep visual scan to detect art boundaries with high precision, ensuring clean gutters and zero background noise.
      </div>
      <div>
        <strong style={{color: '#fff', display: 'block', marginBottom: '5px'}}>High-Fidelity Image Extraction</strong>
        We pull data directly from the source resolution, providing <strong>high-fidelity panel extraction</strong> that maintains sharp quality for professional content archival and distribution.
      </div>
    </div>
  </PageLayout>
} />
          <Route path="/privacy" element={
  <PageLayout title="Privacy Policy">
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px', color: '#aaa'}}>
      <p>
        At <strong>AutoCropper Pro</strong>, we prioritize <strong>User Data Protection</strong> and intellectual property security. Our tool is built on a "Privacy-First" architecture.
      </p>
      <div>
        <strong style={{color: '#fff', display: 'block'}}>No-Logs Data Policy</strong>
        We do not store, monitor, or collect your uploaded images. All <strong>secure image processing</strong> is transient, meaning your files are deleted from the server memory immediately after detection.
      </div>
      <div>
        <strong style={{color: '#fff', display: 'block'}}>Browser-Side Integrity</strong>
        Most of the heavy lifting and preview generation happens directly in your browser, ensuring your <strong>raw creative assets</strong> never stay on external servers longer than necessary.
      </div>
    </div>
  </PageLayout>
} />
          <Route path="/contact" element={
  <PageLayout title="Contact Us">
    <p style={{marginBottom: '20px', color: '#fff'}}>
      Need <strong>Technical Support</strong> or have a feature request for our <strong>slicing automation engine</strong>?
    </p>
    <div style={{display: 'flex', flexDirection: 'column', gap: '15px', color: '#aaa'}}>
      <div>
        <strong style={{color: '#fff', display: 'block'}}>Developer Support Email:</strong>
        <a href="mailto:amirsohail4545@gmail.com" style={{color: '#3b82f6', textDecoration: 'none'}}>amirsohail4545@gmail.com</a>
      </div>
      <div>
        <strong style={{color: '#fff', display: 'block'}}>Global Operations:</strong>
        Headquartered in <strong>Pakistan</strong>, providing digital utilities to a global creator community.
      </div>
      <div>
        <strong style={{color: '#fff', display: 'block'}}>Response SLA:</strong>
        We aim to respond to all <strong>API integration</strong> and user feedback inquiries within 24 to 48 hours.
      </div>
    </div>
  </PageLayout>
} />
          <Route path="/terms" element={
  <PageLayout title="Terms of Service">
    <p style={{marginBottom: '20px', color: '#fff'}}>By accessing this <strong>Image Processing Utility</strong>, you agree to our Service Terms.</p>
    <div style={{display: 'flex', flexDirection: 'column', gap: '20px', color: '#aaa'}}>
      <div>
        <strong style={{color: '#fff', display: 'block'}}>1. Intellectual Property Ownership</strong>
        Users retain full copyright and ownership of any content processed through <strong>AutoCropper Pro</strong>. We claim no rights over your artwork.
      </div>
      <div>
        <strong style={{color: '#fff', display: 'block'}}>2. Usage Limitations</strong>
        This tool is provided for <strong>lawful comic archival</strong> and creative purposes. Any misuse of the automation engine for unauthorized data scraping is prohibited.
      </div>
      <div>
        <strong style={{color: '#fff', display: 'block'}}>3. Fair Use Compliance</strong>
        We encourage users to follow international <strong>Fair Use</strong> guidelines while utilizing our automated cropping tools for educational or archival projects.
      </div>
    </div>
  </PageLayout>
} />
        </Routes>

        <footer style={styles.footer}>
          <div style={styles.footerLinks}>
            <Link to="/about" style={styles.footerLink}>About</Link>
            <Link to="/privacy" style={styles.footerLink}>Privacy</Link>
            <Link to="/contact" style={styles.footerLink}>Contact</Link>
            <Link to="/terms" style={styles.footerLink}>Terms</Link>
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
  btnPrimary: { background: '#2563eb', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display:'flex', alignItems:'center', gap:'5px' },
  btnSecondary: { background: '#333', color: 'white', border: '1px solid #444', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer', fontSize:'12px' },
  btnIcon: { background:'transparent', color:'white', border:'none', cursor:'pointer', padding:'4px' },
  infoBox: { background: '#1e3a8a22', padding: '12px', borderRadius: '8px', border: '1px solid #1e3a8a' },
  adBanner: { height: '70px', background: '#0a0a0a', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  adPlaceholder: { width: '728px', height: '50px', border: '1px dashed #333', color: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' },
  sidebarAd: { marginTop: 'auto', marginBottom: '10px', width:'100%', height:'250px', border:'1px dashed #333', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'#333' }, // Fixed margintop typo
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