# 🌟 Cloudinary Setup for TrashTruck

## ✅ What You Need to Configure

Based on your upload presets shown in the screenshot, here's exactly what to put in your `.env` file:

### 1. Create `.env` File

Create a `.env` file in your project root with these values:

```env
# Cloudinary Configuration
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
EXPO_PUBLIC_CLOUDINARY_API_KEY=your_actual_api_key
EXPO_PUBLIC_CLOUDINARY_API_SECRET=your_actual_api_secret
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=trashtrack_reports

# Your existing Firebase config...
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
```

### 2. Get Your Cloudinary Credentials

From your Cloudinary dashboard:

1. **Cloud Name**: Visible in your dashboard URL or at the top
2. **API Key**: Go to Settings → Security → API Keys
3. **API Secret**: Same location as API Key (keep this secure!)

### 3. Your Upload Presets Are Ready! ✅

Perfect! I can see you've already created:
- `trashtrack_reports` - for report images
- `trashtrack_profile` - for profile images

Both are set to "Unsigned" which is exactly what we need for mobile uploads.

## 🚀 Quick Test

1. **Check Configuration**:
   ```bash
   node scripts/test-cloudinary.js
   ```

2. **Start Your App**:
   ```bash
   npm start
   ```

3. **Test Upload**:
   Use any of the example components to test image uploads.

## 📱 Usage Examples

### Basic Upload (Reports)
```typescript
import { CloudinaryImagePicker } from './components/ImagePicker';

<CloudinaryImagePicker
  onImageSelected={(result) => {
    if (result.success) {
      console.log('Image URL:', result.url);
      // Save to your database
    }
  }}
  folder="REPORTS"
  placeholder="Add report photo"
/>
```

### Profile Image Upload
```typescript
<CloudinaryImagePicker
  onImageSelected={handleProfileUpload}
  folder="PROFILES"
  placeholder="Update profile picture"
  currentImageUrl={currentProfileUrl}
  showPreview={true}
/>
```

### Direct Service Usage
```typescript
import { cloudinaryService } from './services/cloudinaryService';

// Upload with specific preset
const result = await cloudinaryService.uploadImage(imageUri, {
  preset: 'PROFILES', // Uses trashtrack_profile preset
  folder: 'trashtruck/profiles'
});

// Or use default preset
const result = await cloudinaryService.pickAndUploadImage('gallery');
```

## 📁 File Organization

Your images will be organized as:
- Reports: `trashtruck/reports/`
- Profiles: `trashtruck/profiles/`
- Announcements: `trashtruck/announcements/`
- Feedback: `trashtruck/feedback/`

## 🔧 Advanced Configuration

### Multiple Presets
You can use different presets for different image types:

```typescript
// For reports (uses trashtrack_reports preset)
const reportResult = await cloudinaryService.uploadImage(imageUri, {
  preset: 'REPORTS'
});

// For profiles (uses trashtrack_profile preset)
const profileResult = await cloudinaryService.uploadImage(imageUri, {
  preset: 'PROFILES'
});
```

### Generate Optimized URLs
```typescript
// Create thumbnail
const thumbnailUrl = cloudinaryService.generateOptimizedUrl(
  publicId, 
  150, 
  150, 
  'fill'
);

// Create responsive image
const responsiveUrl = cloudinaryService.generateOptimizedUrl(
  publicId, 
  800, 
  600, 
  'limit'
);
```

## 🚨 Security Notes

1. **Never commit `.env` file** - it's already in `.gitignore`
2. **API Secret** should only be used server-side in production
3. **Upload presets** are perfect for mobile apps - they're secure and don't expose secrets
4. **Unsigned uploads** are ideal for your use case

## 🎯 Benefits You'll Get

- ✅ No CORS issues in development
- ✅ Automatic image optimization
- ✅ CDN delivery worldwide
- ✅ Built-in transformations
- ✅ Much simpler code vs Firebase Storage
- ✅ Better error handling
- ✅ Reliable uploads

## 🔍 Troubleshooting

### Environment Variables Not Working?
```bash
# Test your config
node scripts/test-cloudinary.js

# Restart your development server
npm start
```

### Upload Failing?
1. Check your upload preset is set to "Unsigned"
2. Verify your cloud name is correct
3. Check internet connection
4. Look at console logs for specific errors

### Images Not Appearing?
1. Check the returned URL in console
2. Verify the URL is accessible in browser
3. Check if image was uploaded to Cloudinary dashboard

## 📞 Support

- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [React Native Integration](https://cloudinary.com/documentation/react_native_integration)
- [Upload Presets Guide](https://cloudinary.com/documentation/upload_presets)

You're all set! 🎉 Your Cloudinary integration is ready to go.
