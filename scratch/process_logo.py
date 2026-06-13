import os
import math
from PIL import Image

def process_image():
    image_path = r"C:\Users\bao\.gemini\antigravity\brain\cd8c187a-c4d2-4e9d-b1e6-69bcb4e28c90\nexus_logo_1781359425110.png"
    img = Image.open(image_path).convert("RGB")
    width, height = img.size
    
    # Background color sample
    bg_r, bg_g, bg_b = 11, 22, 52
    
    # 1. Find bounding box of the logo
    min_x, min_y = width, height
    max_x, max_y = 0, 0
    
    # We will check pixels to find the bounding box where distance is > 20
    pixels = img.load()
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            dist = math.sqrt((r - bg_r)**2 + (g - bg_g)**2 + (b - bg_b)**2)
            if dist > 25: # threshold for logo presence
                if x < min_x: min_x = x
                if y < min_y: min_y = y
                if x > max_x: max_x = x
                if y > max_y: max_y = y
                
    print(f"Bounding box: ({min_x}, {min_y}) to ({max_x}, max_y: {max_y})")
    
    # Crop the image with some padding
    padding = 20
    crop_box = (
        max(0, min_x - padding),
        max(0, min_y - padding),
        min(width, max_x + padding),
        min(height, max_y + padding)
    )
    cropped_img = img.crop(crop_box)
    print(f"Cropped image size: {cropped_img.size}")
    
    # 2. Make background transparent
    # Convert cropped image to RGBA
    cropped_rgba = cropped_img.convert("RGBA")
    rgba_pixels = cropped_rgba.load()
    c_width, c_height = cropped_img.size
    
    for y in range(c_height):
        for x in range(c_width):
            r, g, b, a = rgba_pixels[x, y]
            
            # Distance from background color
            dist = math.sqrt((r - bg_r)**2 + (g - bg_g)**2 + (b - bg_b)**2)
            
            # Simple soft threshold
            # Under dist_min -> fully transparent (alpha 0)
            # Above dist_max -> fully opaque (alpha 255)
            # In between -> linear ramp
            dist_min = 15.0
            dist_max = 90.0
            
            if dist < dist_min:
                alpha = 0
            elif dist > dist_max:
                alpha = 255
            else:
                alpha = int(255 * (dist - dist_min) / (dist_max - dist_min))
            
            # Un-blend background to recover original foreground color
            if alpha > 0:
                normalized_alpha = alpha / 255.0
                # Formula: F = (P - (1 - alpha)*B0) / alpha
                new_r = int(max(0, min(255, (r - (1.0 - normalized_alpha) * bg_r) / normalized_alpha)))
                new_g = int(max(0, min(255, (g - (1.0 - normalized_alpha) * bg_g) / normalized_alpha)))
                new_b = int(max(0, min(255, (b - (1.0 - normalized_alpha) * bg_b) / normalized_alpha)))
            else:
                new_r, new_g, new_b = 0, 0, 0
                
            rgba_pixels[x, y] = (new_r, new_g, new_b, alpha)
            
    # Save processed image as artifact
    output_path = r"C:\Users\bao\.gemini\antigravity\brain\cd8c187a-c4d2-4e9d-b1e6-69bcb4e28c90\nexus_logo_processed.png"
    cropped_rgba.save(output_path, "PNG")
    print(f"Saved processed logo to: {output_path}")

if __name__ == "__main__":
    process_image()
