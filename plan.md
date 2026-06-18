## Plan for 4-Corner Document Alignment

1. **Frontend Custom Selector**:
   - `react-image-crop` only supports axis-aligned rectangles, so we cannot use it for 4-point trapezoids.
   - I will create a custom SVG overlay inside `ImageEditorModal.jsx` (or a separate component) that displays a `<polygon>` and 4 draggable `<circle>` handles (top-left, top-right, bottom-right, bottom-left).
   - We will track the coordinates of these 4 points (in percentages to handle responsive resizing) and convert them to actual image pixel coordinates on save.

2. **Backend Processing (Heavy Lifting)**:
   - Doing perspective warping in the browser via Canvas/JS is slow and complex.
   - We already have `pdf/scan_processor.py` doing OpenCV `four_point_transform`!
   - I will modify `server.js` and `scan_processor.py` to accept an optional `--corners "x1,y1,x2,y2,x3,y3,x4,y4"` parameter.
   - If the user provides 4 corners, the Python script skips auto-detection (`cv2.findContours`) and uses exactly those points to crop and warp the document.

3. **Workflow**:
   - User uploads an image -> The modal opens in "4-corner mode".
   - User drags the 4 corners to the passport/ID edges.
   - Clicks "Готово - выровнять документ".
   - The frontend sends the **full original image** + the **4 coordinates** to `POST /api/document/process-scan-preview`.
   - The backend OpenCV script extracts the trapezoid, warps it into a perfect rectangle (using the 1.42 or 1.586 ratio), applies the natural contrast filter, and returns the result.

4. **Fallback (Safety)**:
   - If the backend processing fails (e.g., timeout or network error), the frontend will automatically calculate a standard rectangular bounding box that contains the 4 selected points, crop it using the standard HTML Canvas method, and proceed with OCR. This ensures the user is never blocked.
