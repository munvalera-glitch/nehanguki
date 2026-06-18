import cv2
import numpy as np
import sys
import argparse

def order_points(pts):
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect

def four_point_transform(image, pts):
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    widthA = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    widthB = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    maxWidth = max(int(widthA), int(widthB))
    heightA = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    heightB = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    maxHeight = max(int(heightA), int(heightB))
    dst = np.array([
        [0, 0],
        [maxWidth - 1, 0],
        [maxWidth - 1, maxHeight - 1],
        [0, maxHeight - 1]], dtype="float32")
    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (maxWidth, maxHeight))
    return warped

def process_scan(input_path, output_path, doc_type, corners=None, keep_color='false'):
    image = cv2.imread(input_path)
    if image is None:
        sys.exit(1)
        
    orig = image.copy()
    ratio = image.shape[0] / 500.0
    
    h = 500
    w = int(image.shape[1] * (500.0 / image.shape[0]))
    if w == 0 or h == 0:
        w, h = image.shape[1], image.shape[0]
        ratio = 1.0
        resized = image
    else:
        resized = cv2.resize(image, (w, h))
    
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(gray, 75, 200)
    
    cnts, _ = cv2.findContours(edged.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    cnts = sorted(cnts, key=cv2.contourArea, reverse=True)[:5]
    
    screenCnt = None
    for c in cnts:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            screenCnt = approx
            break
            
    warped = orig
    if corners:
        c_pts = [float(x) for x in corners.split(",")]
        pts = np.array(c_pts, dtype="float32").reshape(4, 2)
        warped = four_point_transform(orig, pts)
    elif screenCnt is not None and cv2.contourArea(screenCnt) > 10000:
        warped = four_point_transform(orig, screenCnt.reshape(4, 2) * ratio)
        
    if doc_type == 'passport':
        target_ar = 1.42
    elif doc_type == 'idcard':
        target_ar = 1.586
    elif doc_type == 'contract':
        target_ar = 1.414 
    else:
        target_ar = None
        
    if target_ar:
        cur_h, cur_w = warped.shape[:2]
        if cur_h > cur_w:
            new_w = cur_w
            new_h = int(cur_w * target_ar)
        else:
            new_w = cur_w
            new_h = int(cur_w / target_ar)
        warped = cv2.resize(warped, (new_w, new_h))
        
    if doc_type == 'contract':
        alpha = 1.1
        beta = 5
    elif doc_type == 'passport_full':
        alpha = 1.0
        beta = 0
    else:
        alpha = 1.10
        beta = 5
        
    if keep_color == 'true':
        adjusted = cv2.convertScaleAbs(warped, alpha=alpha, beta=beta)
    else:
        warped_gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        adjusted = cv2.convertScaleAbs(warped_gray, alpha=alpha, beta=beta)
    
    cv2.imwrite(output_path, adjusted, [cv2.IMWRITE_JPEG_QUALITY, 95])

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--doc_type", required=True)
    parser.add_argument("--corners", required=False, help="Comma separated x1,y1,x2,y2,x3,y3,x4,y4")
    parser.add_argument("--keep_color", required=False, default="false", help="Whether to keep the original color")
    args = parser.parse_args()
    process_scan(args.input, args.output, args.doc_type, args.corners, args.keep_color)
