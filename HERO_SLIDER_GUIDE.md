# Hero Slider Image Guide

## Current Configuration

The hero slider now displays images **without cropping** using `object-contain`. This means:
- ✅ Full image is always visible (no parts cut off)
- ✅ Maintains original aspect ratio
- ✅ Gray background fills empty space if needed
- ✅ Works with any image dimensions

## Recommended Image Dimensions

### Best Practice (16:9 Aspect Ratio)
For optimal display on all devices, use **16:9 landscape images**:

| Size | Resolution | Use Case |
|------|-----------|----------|
| **HD** | 1280 × 720 | Mobile & Tablet |
| **Full HD** | 1920 × 1080 | Desktop & TV |
| **2K** | 2560 × 1440 | High-res displays |
| **4K** | 3840 × 2160 | Ultra high-res |

### Quick References

```
16:9 Aspect Ratio Examples:
- 800 × 450
- 1024 × 576
- 1280 × 720 ✓ (Recommended minimum)
- 1600 × 900
- 1920 × 1080 ✓ (Recommended standard)
- 2560 × 1440
```

## How Different Aspect Ratios Look

### Landscape (16:9) - IDEAL ✓
```
┌─────────────────────────────────┐
│                                 │
│     [Image fills nicely]        │
│                                 │
└─────────────────────────────────┘
```

### Portrait (9:16)
```
┌────────────┐
│            │
│            │  ← Gray background
│   Image    │     on sides
│            │  ← Gray background
│            │
└────────────┘
```

### Square (1:1)
```
┌──────────────────────────────────┐
│  Gray      ┌────────────┐   Gray │
│  back    │    Image    │  back   │
│  ground   │    Square   │  ground │
│            └────────────┘         │
└──────────────────────────────────┘
```

## Optimization Tips

### 1. Image Format
- **JPG**: Best for photographs (smaller file size)
- **PNG**: For images with transparency
- **WebP**: Modern format (smaller, but less browser support)
- **AVIF**: Newest format (best compression)

### 2. File Size
- Aim for **300KB - 2MB** per image
- Recommended: **500KB - 1.5MB**
- Use online tools to optimize:
  - TinyPNG.com
  - Squoosh.app
  - ImageOptim (Mac)

### 3. Quality Settings
```
JPG Compression: 75-85% quality
PNG: Use 8-bit if possible
```

## How to Prepare Images

### Using Photoshop
```
1. Image > Image Size
2. Set to 1920 × 1080 pixels
3. Resolution: 72 DPI for web
4. Export as JPG with 80% quality
```

### Using Online Tools
1. Go to **Squoosh.app**
2. Upload image
3. Set to 1920 × 1080
4. Adjust quality slider to 75-85%
5. Download

### Using ImageMagick (Command Line)
```bash
# Resize & optimize
convert input.jpg -resize 1920x1080 \
  -quality 80 output.jpg

# Multiple images
mogrify -resize 1920x1080 -quality 80 *.jpg
```

## Mobile Responsive Heights

The hero slider heights are:
- **Mobile**: 256px (h-64)
- **Tablet**: 320px (md:h-80)
- **Desktop**: 384px (lg:h-96)

Images automatically scale to fit these heights while maintaining aspect ratio.

## Upload Guidelines in Admin

1. Go to **Admin > Hero Slider**
2. Click **Tambah Slide**
3. Upload your optimized image (1920×1080 recommended)
4. Set title (optional)
5. Set sort order (0 = first)
6. Click **Tambah Slide**

## Examples

### Good Image ✓
```
1920 × 1080 JPG
File size: 800KB
16:9 aspect ratio
Landscape orientation
High quality
```

### Suboptimal Image ⚠️
```
1200 × 800 JPG
File size: 2.5MB
3:2 aspect ratio (will have gray bars)
Quality okay but larger file
```

### Poor Image ✗
```
600 × 800 PNG
File size: 5MB
Portrait orientation
Low resolution on large screens
```

## Troubleshooting

### Image looks blurry on large screens
- Upload higher resolution (aim for 1920×1080+)
- Check image quality settings

### Too much gray background on sides
- Image is too portrait-oriented
- Use images closer to 16:9 aspect ratio

### Image loads slowly
- Optimize file size (< 1.5MB)
- Use JPG instead of PNG for photos
- Use an image compression tool

### Image appears too small on mobile
- This is normal - adjust mobile height if needed
- Consider using more vertical images

## Advanced: Custom Heights

To change slider heights, edit `views/public/index.ejs`:

```ejs
<!-- Current sizes -->
<div id="hero-slider" class="relative h-64 md:h-80 lg:h-96">

<!-- Make it taller on all devices -->
<div id="hero-slider" class="relative h-80 md:h-96 lg:[28rem]">

<!-- Make it shorter -->
<div id="hero-slider" class="relative h-48 md:h-64 lg:h-80">
```

Tailwind height classes:
- `h-48` = 192px
- `h-64` = 256px  (current mobile)
- `h-80` = 320px  (current tablet)
- `h-96` = 384px  (current desktop)

## Summary

| Aspect | Recommendation |
|--------|-----------------|
| **Resolution** | 1920 × 1080 |
| **Aspect Ratio** | 16:9 (landscape) |
| **File Format** | JPG |
| **File Size** | 500KB - 1.5MB |
| **Quality** | 75-85% |
| **Min Width** | 1280px |
