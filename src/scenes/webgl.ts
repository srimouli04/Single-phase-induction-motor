/** True when the browser can create a WebGL context (the 3D view needs it; otherwise the 2D view is used). */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext(); // free the probe context immediately
    return true;
  } catch {
    return false;
  }
}
