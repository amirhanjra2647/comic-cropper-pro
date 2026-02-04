import React, { useEffect, useState, useRef } from 'react';
import { fabric } from 'fabric';
import axios from 'axios';
import { Trash2, ZoomIn, ZoomOut, Download, Maximize, RefreshCw, Star, Layers, Info } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const App = () => {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);

  // Paddle Integration for Pakistan Automation
  useEffect(() => {
    if (window.Paddle) {
      window.Paddle.Setup({ vendor: 12345 }); // Apna Vendor ID yahan likhein
    }
  }, []);

  const handleUpgrade = () => {
    window.Paddle.Checkout.open({
      product: 67890, // Apna Price ID yahan likhein
      successCallback: (data) => {
        setIsPro(true);
        alert("Mubarak ho! Pro features unlock ho gaye hain.");
      }
    });
  };

  // Batch Crop Logic (ZIP Download)
  const handleBatchUpload = async (e) => {
    if (!isPro) {
      alert("Batch Crop sirf PRO members ke liye hy.");
      return;
    }
    const files = Array.from(e.target.files);
    const zip = new JSZip();
    setLoading(true);

    try {
      for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post('https://comic-cropper-pro.onrender.com/detect', formData);
        
        // Processing logic yahan aayegi jo panels ko ZIP mein add karegi
        zip.file(`${file.name}_crop.png`, "dummy_data"); 
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "Batch_Crops.zip");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans">
      {/* Sidebar - Based on your Sketch */}
      <div className="w-64 bg-gray-800 p-4 flex flex-col border-r border-gray-700">
        <h1 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Layers className="text-blue-400" /> Comic Crop
        </h1>

        {/* Action Buttons */}
        <div className="space-y-3 mb-6">
          <button className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition">
            <Maximize size={18} /> Auto-Detect
          </button>
          
          <label className={`w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 cursor-pointer transition ${isPro ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-gray-700 opacity-50'}`}>
            <Star size={18} fill={isPro ? "black" : "none"} /> 
            Batch Crop {!isPro && "(PRO)"}
            <input type="file" multiple hidden disabled={!isPro} onChange={handleBatchUpload} />
          </label>
        </div>

        {/* How to Use Box (11px font) */}
        <div className="bg-gray-700/50 p-3 rounded-md border border-gray-600 mb-6">
          <p className="text-[11px] leading-relaxed text-gray-300">
            <Info size={12} className="inline mr-1 mb-1" />
            <strong>How to Use:</strong> Upload your manga strip. Click 'Auto-Detect' to find panels. Use 'Batch Crop' for multiple files (PRO).
          </p>
        </div>

        {/* Spacer for AdSense Sidebar Slot */}
        <div className="flex-grow flex items-center justify-center border-2 border-dashed border-gray-700 rounded-md my-4">
          <span className="text-gray-500 text-xs">AdSense Sidebar Ad</span>
        </div>

        {/* Footer Links */}
        <div className="mt-auto pt-4 border-t border-gray-700 text-xs text-gray-400 flex flex-wrap gap-2 justify-center">
          <button className="hover:text-white">Clear All</button>
          <span>•</span>
          <button className="hover:text-white">Privacy</button>
          <span>•</span>
          <button className="hover:text-white" onClick={handleUpgrade}>Upgrade</button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {loading && <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center text-xl">Processing...</div>}
        <canvas ref={canvasRef} className="mx-auto shadow-2xl mt-10" />
      </div>
    </div>
  );
};

export default App;