# TrashTrack - RAG AI Chatbot App

A React Native + Expo app with a RAG (Retrieval-Augmented Generation) AI chatbot powered by Firebase, Groq API, and Firestore.

## 🚀 Features

- **RAG AI Chatbot**: Intelligent responses using document retrieval and Groq's LLaMA 3 model
- **Real-time Chat UI**: Beautiful, responsive chat interface
- **Document Management**: Add and manage knowledge base documents
- **Firebase Integration**: Secure backend with Firestore and Cloud Functions
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

### 5. Update App Configuration

1. **Update Firebase Config** in `config/firebase.ts`:
   ```typescript
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "your-sender-id",
     appId: "your-app-id"
   };
   ```

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
