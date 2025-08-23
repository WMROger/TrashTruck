# TrashTrack - RAG AI Chatbot App

A React Native + Expo app with a RAG (Retrieval-Augmented Generation) AI chatbot powered by Firebase, Groq API, and Firestore.

## 🚀 Features

- **RAG AI Chatbot**: Intelligent responses using document retrieval and Groq's LLaMA 3 model
- **Real-time Chat UI**: Beautiful, responsive chat interface
- **Document Management**: Add and manage knowledge base documents
- **Firebase Integration**: Secure backend with Firestore and Cloud Functions
- **Social Authentication**: Google and Facebook login support
- **Cross-platform**: Works on iOS, Android, and Web

## 🏗️ Architecture

```
User Input → React Native Chat UI
    ↓
Firebase Cloud Function
    ↓
Document Retrieval (Firestore)
    ↓
Groq API (LLaMA 3)
    ↓
AI Response → Chat UI
```

## 📋 Prerequisites

- Node.js 18+
- Expo CLI
- Firebase CLI
- Groq API Key

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Setup

1. **Install Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase** (if not already done):
   ```bash
   firebase init
   ```

4. **Update Firebase Config**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or select existing one
   - Get your project configuration
   - Update `config/firebase.ts` with your config

### 3. Configure Groq API

1. **Get Groq API Key**:
   - Sign up at [Groq Console](https://console.groq.com/)
   - Generate an API key

2. **Set Firebase Function Config**:
   ```bash
   firebase functions:config:set groq.key="your_groq_api_key"
   ```

### 4. Deploy Firebase Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### 5. Social Authentication Setup

For Google and Facebook login functionality, follow the detailed setup guide in [`docs/social-login-setup.md`](docs/social-login-setup.md).

**Quick Setup**:
1. **Google Sign-In**:
   - Create OAuth 2.0 credentials in Google Cloud Console
   - Enable Google authentication in Firebase
   - Add client IDs to environment variables

2. **Facebook Sign-In**:
   - Create a Facebook app in Facebook Developers Console
   - Enable Facebook authentication in Firebase
   - Add app ID and client token to environment variables

### 6. Environment Variables Setup

1. **Create Environment File**:
   ```bash
   # Option 1: Use the setup script (recommended)
   npm run setup-env
   
   # Option 2: Manual setup
   cp .env.example .env
   ```

2. **Update Firebase Configuration**:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project
   - Go to Project Settings > General
   - Scroll down to "Your apps" section

### 6. Authentication Setup

1. **Enable Authentication Methods**:
   - In Firebase Console, go to "Authentication" > "Sign-in method"
   - Enable Email/Password authentication
   - Optionally enable Google and Facebook sign-in

2. **Configure OAuth Providers** (Optional):
   - For Google: Set up OAuth 2.0 client ID
   - For Facebook: Configure Facebook App ID and Secret

3. **Test Authentication**:
   - Run the app: `npm start`
   - Try creating an account and signing in
   - Check console for any authentication errors

For detailed authentication setup instructions, see [docs/firebase-setup.md](docs/firebase-setup.md).
   - Copy the configuration values
   - Update your `.env` file with the actual values:

   ```env
   EXPO_PUBLIC_FIREBASE_API_KEY=your-actual-api-key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

   ⚠️ **Important**: Never commit your `.env` file to version control. It's already added to `.gitignore`.

### 6. Run the App

```bash
# Start Expo development server
npm start

# Run on specific platform
npm run ios
npm run android
npm run web
```

## 📱 App Structure

```
TrashTruck/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Authentication page
│   │   ├── explore.tsx        # Chat screen
│   │   └── _layout.tsx        # Tab navigation
│   ├── SplashScreen.tsx       # Onboarding screen
│   └── _layout.tsx            # Root layout
├── components/
│   ├── ChatMessage.tsx        # Chat message component
│   └── ...
├── config/
│   └── firebase.ts            # Firebase configuration
├── functions/
│   ├── index.js               # Firebase Cloud Functions
│   └── package.json           # Functions dependencies
└── ...
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
GROQ_API_KEY=your_groq_api_key
FIREBASE_PROJECT_ID=your_project_id
```

### Firebase Functions Configuration

The functions are configured to use:
- **Groq API**: For AI responses using LLaMA 3
- **Firestore**: For document storage and chat logs
- **Keyword-based retrieval**: Simple document matching

## 📚 Knowledge Base

The app comes with sample documents about TrashTrack. You can:

1. **Add Documents** via Firebase Console
2. **Use the `addDocument` function** to programmatically add content
3. **Customize the retrieval logic** in `functions/index.js`

## 🔒 Security

⚠️ **Important**: The current Firestore rules allow public read/write access for demo purposes. For production:

1. **Enable Authentication**:
   ```bash
   firebase init auth
   ```

2. **Update Firestore Rules**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /chat_logs/{document} {
         allow read, write: if request.auth != null;
       }
       match /documents/{document} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

## 🚀 Deployment

### Deploy to Expo

```bash
# Build for production
expo build:android
expo build:ios
expo build:web
```

### Deploy Firebase Functions

```bash
firebase deploy --only functions
```

## 🐛 Troubleshooting

### Common Issues

1. **Firebase Functions Not Deployed**:
   ```bash
   firebase functions:log
   ```

2. **Groq API Key Issues**:
   - Verify the key is set: `firebase functions:config:get`
   - Check Groq console for usage limits

3. **App Not Connecting to Firebase**:
   - Verify Firebase config in `config/firebase.ts`
   - Check network connectivity

### Debug Mode

Enable debug logging in the chat screen by adding:

```typescript
console.log('Firebase Functions Response:', result);
```

## 📈 Future Enhancements

- [ ] Vector embeddings for better document retrieval
- [ ] User authentication and chat history
- [ ] File upload for document management
- [ ] Real-time chat with multiple users
- [ ] Analytics and usage tracking
- [ ] Custom AI model fine-tuning

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, please:
1. Check the troubleshooting section
2. Review Firebase and Groq documentation
3. Open an issue on GitHub

---

**Built with ❤️ using React Native, Expo, Firebase, and Groq**
