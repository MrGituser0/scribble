import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, RotateCcw, RotateCw, Trash2 } from "lucide-react";

const palette = ["#20233d", "#ffffff", "#ff655a", "#ffab42", "#f7d84a", "#66c879", "#4fc3d7", "#5a8dee", "#9d71e8", "#f171b5", "#9b6b48", "#a9b0bf"];

function paintStroke(context, stroke, width, height) {
  if (!stroke?.points?.length) return;
  const [first, ...rest] = stroke.points;
  context.beginPath();
  context.moveTo(first.x * width, first.y * height);
  for (const point of rest) context.lineTo(point.x * width, point.y * height);
  if (rest.length === 0) context.lineTo(first.x * width + 0.01, first.y * height + 0.01);
  context.strokeStyle = stroke.color;
  context.lineWidth = stroke.size;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.stroke();
}

export default function DrawCanvas({ socket, isArtist, round, hint }) {
  const canvasRef = useRef(null);
  const currentRef = useRef(null);
  const activeRemoteRef = useRef(null);
  const strokesRef = useRef([]);
  const [strokes, setStrokes] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [color, setColor] = useState("#20233d");
  const [size, setSize] = useState(6);
  const [eraser, setEraser] = useState(false);

  const updateStrokes = useCallback((items) => {
    strokesRef.current = items;
    setStrokes(items);
  }, []);

  const repaint = useCallback((items = strokesRef.current, current = currentRef.current) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const bounds = canvas.getBoundingClientRect();
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    items.forEach((stroke) => paintStroke(context, stroke, bounds.width, bounds.height));
    if (current) paintStroke(context, current, bounds.width, bounds.height);
  }, []);

  const setBoard = useCallback((items, sync = false) => {
    currentRef.current = null;
    strokesRef.current = items;
    setStrokes(items);
    if (sync) socket.emit("draw:sync", items);
    requestAnimationFrame(() => repaint(items, null));
  }, [repaint, socket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      const context = canvas.getContext("2d");
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      repaint();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    return () => observer.disconnect();
  }, [repaint]);

  useEffect(() => {
    updateStrokes([]);
    setRedoStack([]);
    currentRef.current = null;
    requestAnimationFrame(() => repaint([], null));
  }, [round, repaint, updateStrokes]);

  useEffect(() => {
    const onStart = ({ stroke }) => { activeRemoteRef.current = stroke; repaint(strokesRef.current, stroke); };
    const onPoints = ({ points }) => {
      if (!activeRemoteRef.current) return;
      activeRemoteRef.current = { ...activeRemoteRef.current, points: [...activeRemoteRef.current.points, ...points] };
      repaint(strokesRef.current, activeRemoteRef.current);
    };
    const onEnd = () => {
      if (!activeRemoteRef.current) return;
      const next = [...strokesRef.current, activeRemoteRef.current];
      activeRemoteRef.current = null;
      updateStrokes(next);
      repaint(next, null);
    };
    const onClear = () => { updateStrokes([]); setRedoStack([]); repaint([], null); };
    const onSync = (next) => {
      if (!Array.isArray(next)) return;
      updateStrokes(next);
      repaint(next, null);
    };
    socket.on("draw:start", onStart);
    socket.on("draw:points", onPoints);
    socket.on("draw:end", onEnd);
    socket.on("draw:clear", onClear);
    socket.on("draw:sync", onSync);
    return () => {
      socket.off("draw:start", onStart);
      socket.off("draw:points", onPoints);
      socket.off("draw:end", onEnd);
      socket.off("draw:clear", onClear);
      socket.off("draw:sync", onSync);
    };
  }, [repaint, socket, updateStrokes]);

  const position = (event) => {
    const bounds = canvasRef.current.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
  };
  const pointerDown = (event) => {
    if (!isArtist) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    currentRef.current = { color: eraser ? "#ffffff" : color, size: eraser ? Math.max(size * 3, 18) : size, points: [position(event)] };
    repaint(strokes);
    socket.emit("draw:start", { stroke: currentRef.current });
  };
  const pointerMove = (event) => {
    if (!currentRef.current) return;
    const point = position(event);
    currentRef.current.points.push(point);
    repaint(strokes);
    socket.emit("draw:points", { points: [point] });
  };
  const pointerUp = () => {
    if (!currentRef.current) return;
    const next = [...strokesRef.current, currentRef.current];
    currentRef.current = null;
    updateStrokes(next);
    setRedoStack([]);
    repaint(next, null);
    socket.emit("draw:end");
  };
  const undo = () => {
    if (!isArtist || !strokes.length) return;
    const removed = strokes[strokes.length - 1];
    const next = strokes.slice(0, -1);
    setRedoStack((stack) => [...stack, removed]);
    setBoard(next, true);
  };
  const redo = () => {
    if (!isArtist || !redoStack.length) return;
    const next = [...strokes, redoStack[redoStack.length - 1]];
    setRedoStack(redoStack.slice(0, -1));
    setBoard(next, true);
  };
  const clear = () => {
    if (!isArtist) return;
    setBoard([]);
    setRedoStack([]);
    socket.emit("draw:clear");
  };

  return (
    <div className={`drawing-panel ${isArtist ? "drawing-enabled" : ""}`}>
      <div className="canvas-heading">
        <div>{isArtist ? <><span className="mini-label">YOUR SECRET WORD</span><strong className="secret-word">{hint}</strong></> : <><span className="mini-label">GUESS THE DOODLE</span><strong className="word-hint">{hint || "???"}</strong></>}</div>
        <div className="canvas-controls">
          <button type="button" className="tool-button" title="Undo" onClick={undo} disabled={!isArtist || !strokes.length}><RotateCcw size={17} /></button>
          <button type="button" className="tool-button" title="Redo" onClick={redo} disabled={!isArtist || !redoStack.length}><RotateCw size={17} /></button>
          <button type="button" className="tool-button" title="Clear canvas" onClick={clear} disabled={!isArtist}><Trash2 size={17} /></button>
        </div>
      </div>
      <canvas ref={canvasRef} className="drawing-canvas" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label={isArtist ? "Drawing canvas" : "Live drawing"} />
      <div className={`drawing-toolbar ${!isArtist ? "toolbar-disabled" : ""}`}>
        <div className="color-palette">{palette.map((item) => <button key={item} type="button" aria-label={`Use ${item}`} aria-pressed={!eraser && color === item} className={`swatch ${color === item && !eraser ? "swatch-active" : ""}`} style={{ "--swatch": item }} onClick={() => { setColor(item); setEraser(false); }} disabled={!isArtist} />)}</div>
        <label className="custom-color" title="Choose any color"><input type="color" aria-label="Custom color" value={color} onChange={(event) => { setColor(event.target.value); setEraser(false); }} disabled={!isArtist} /></label>
        <div className="tool-divider" />
        <label className="brush-size"><span>SIZE</span><input type="range" min="2" max="22" value={size} onChange={(event) => setSize(Number(event.target.value))} disabled={!isArtist} /><i style={{ width: size, height: size }} /></label>
        <button type="button" className={`tool-button eraser-button ${eraser ? "tool-active" : ""}`} title="Eraser" onClick={() => setEraser(!eraser)} disabled={!isArtist}><Eraser size={18} /></button>
      </div>
      {!isArtist && <div className="spectator-label">✦ Your turn to guess! ✦</div>}
    </div>
  );
}
