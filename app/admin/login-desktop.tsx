import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminButton from '../../components/admin/AdminButton';
import AdminInput from '../../components/admin/AdminInput';

const { width, height } = Dimensions.get('window');

// Desktop-specific styles
const desktopStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  mainCard: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  leftPanel: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  rightPanel: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    padding: 80,
    justifyContent: 'center',
    minWidth: 500,
    maxWidth: 600,
  },
  welcomeText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#2E8B57',
    marginBottom: 60,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 50,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: '#2E8B57',
    borderRadius: 6,
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2E8B57',
  },
  checkboxText: {
    fontSize: 18,
    color: '#333',
  },
  forgotPassword: {
    marginLeft: 'auto',
  },
  forgotPasswordText: {
    fontSize: 16,
    color: '#999',
  },
  // Enhanced illustration styles for desktop
  illustration: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: '#87CEEB',
  },
  hills: {
    position: 'absolute',
    bottom: '15%',
    left: 0,
    right: 0,
    height: '35%',
  },
  hill1: {
    position: 'absolute',
    bottom: 0,
    left: -80,
    right: -80,
    height: 120,
    backgroundColor: '#90EE90',
    borderRadius: 150,
  },
  hill2: {
    position: 'absolute',
    bottom: 0,
    left: 80,
    right: 80,
    height: 90,
    backgroundColor: '#98FB98',
    borderRadius: 150,
  },
  trees: {
    position: 'absolute',
    bottom: '20%',
    left: 0,
    right: 0,
    height: '30%',
  },
  tree1: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    width: 40,
    height: 80,
    backgroundColor: '#228B22',
    borderRadius: 20,
  },
  tree2: {
    position: 'absolute',
    bottom: 0,
    left: '45%',
    width: 35,
    height: 70,
    backgroundColor: '#32CD32',
    borderRadius: 17,
  },
  tree3: {
    position: 'absolute',
    bottom: 0,
    left: '75%',
    width: 45,
    height: 90,
    backgroundColor: '#228B22',
    borderRadius: 22,
  },
  cityBuildings: {
    position: 'absolute',
    bottom: '25%',
    left: '5%',
    height: '25%',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  building1: {
    width: 30,
    height: 60,
    backgroundColor: '#696969',
    marginRight: 8,
  },
  building2: {
    width: 35,
    height: 80,
    backgroundColor: '#808080',
    marginRight: 8,
  },
  building3: {
    width: 40,
    height: 70,
    backgroundColor: '#A9A9A9',
  },
  characters: {
    position: 'absolute',
    bottom: '10%',
    left: 0,
    right: 0,
    height: '35%',
  },
  person1: {
    position: 'absolute',
    bottom: 0,
    left: '10%',
    alignItems: 'center',
  },
  head1: {
    width: 28,
    height: 28,
    backgroundColor: '#FFB6C1',
    borderRadius: 14,
  },
  body1: {
    width: 40,
    height: 55,
    backgroundColor: '#4169E1',
    borderRadius: 8,
  },
  arm1: {
    position: 'absolute',
    right: -15,
    top: 15,
    width: 20,
    height: 10,
    backgroundColor: '#FFB6C1',
    borderRadius: 5,
  },
  broom: {
    position: 'absolute',
    right: -35,
    top: 10,
    width: 40,
    height: 6,
    backgroundColor: '#4169E1',
    borderRadius: 3,
  },
  person2: {
    position: 'absolute',
    bottom: 0,
    left: '40%',
    alignItems: 'center',
  },
  head2: {
    width: 26,
    height: 26,
    backgroundColor: '#8B4513',
    borderRadius: 13,
  },
  body2: {
    width: 35,
    height: 50,
    backgroundColor: '#FF0000',
    borderRadius: 8,
  },
  arm2: {
    position: 'absolute',
    right: -20,
    top: 12,
    width: 16,
    height: 8,
    backgroundColor: '#FFB6C1',
    borderRadius: 4,
  },
  bag: {
    position: 'absolute',
    right: -30,
    top: 8,
    width: 25,
    height: 35,
    backgroundColor: '#808080',
    borderRadius: 4,
  },
  person3: {
    position: 'absolute',
    bottom: 0,
    left: '70%',
    alignItems: 'center',
  },
  head3: {
    width: 30,
    height: 30,
    backgroundColor: '#8B4513',
    borderRadius: 15,
  },
  body3: {
    width: 38,
    height: 52,
    backgroundColor: '#87CEEB',
    borderRadius: 8,
  },
  arm3: {
    position: 'absolute',
    right: -18,
    top: 15,
    width: 18,
    height: 9,
    backgroundColor: '#8B4513',
    borderRadius: 4,
  },
  bottle: {
    position: 'absolute',
    right: -25,
    top: 12,
    width: 10,
    height: 20,
    backgroundColor: '#32CD32',
    borderRadius: 5,
  },
  trashItems: {
    position: 'absolute',
    bottom: '5%',
    left: 0,
    right: 0,
    height: '15%',
  },
  bottle1: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    width: 8,
    height: 16,
    backgroundColor: '#32CD32',
    borderRadius: 4,
  },
  paper1: {
    position: 'absolute',
    bottom: 0,
    left: '30%',
    width: 12,
    height: 8,
    backgroundColor: '#F5F5DC',
    borderRadius: 3,
  },
  bottle2: {
    position: 'absolute',
    bottom: 0,
    left: '60%',
    width: 7,
    height: 14,
    backgroundColor: '#FF6347',
    borderRadius: 3,
  },
  trashCan: {
    position: 'absolute',
    bottom: '2%',
    left: '50%',
    alignItems: 'center',
  },
  canBody: {
    width: 40,
    height: 55,
    backgroundColor: '#808080',
    borderRadius: 8,
  },
  biohazardSymbol: {
    position: 'absolute',
    top: 8,
    width: 25,
    height: 25,
    backgroundColor: '#FF0000',
    borderRadius: 12,
  },
});

export default function AdminLoginDesktop() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  const handleLogin = () => {
    // TODO: Implement login logic
    console.log('Login attempt:', { username, password, keepLoggedIn });
  };

  return (
    <SafeAreaView style={desktopStyles.container}>
      <View style={desktopStyles.mainCard}>
        {/* Left Panel - Illustration */}
        <View style={desktopStyles.leftPanel}>
          <View style={desktopStyles.illustration}>
            {/* Sky */}
            <View style={desktopStyles.sky} />
            
            {/* Hills */}
            <View style={desktopStyles.hills}>
              <View style={desktopStyles.hill1} />
              <View style={desktopStyles.hill2} />
            </View>
            
            {/* Trees */}
            <View style={desktopStyles.trees}>
              <View style={desktopStyles.tree1} />
              <View style={desktopStyles.tree2} />
              <View style={desktopStyles.tree3} />
            </View>
            
            {/* City Buildings */}
            <View style={desktopStyles.cityBuildings}>
              <View style={desktopStyles.building1} />
              <View style={desktopStyles.building2} />
              <View style={desktopStyles.building3} />
            </View>
            
            {/* Characters */}
            <View style={desktopStyles.characters}>
              {/* Person 1 - Sweeping */}
              <View style={desktopStyles.person1}>
                <View style={desktopStyles.head1} />
                <View style={desktopStyles.body1} />
                <View style={desktopStyles.arm1} />
                <View style={desktopStyles.broom} />
              </View>
              
              {/* Person 2 - Holding bag */}
              <View style={desktopStyles.person2}>
                <View style={desktopStyles.head2} />
                <View style={desktopStyles.body2} />
                <View style={desktopStyles.arm2} />
                <View style={desktopStyles.bag} />
              </View>
              
              {/* Person 3 - Holding bottle */}
              <View style={desktopStyles.person3}>
                <View style={desktopStyles.head3} />
                <View style={desktopStyles.body3} />
                <View style={desktopStyles.arm3} />
                <View style={desktopStyles.bottle} />
              </View>
            </View>
            
            {/* Trash Items */}
            <View style={desktopStyles.trashItems}>
              <View style={desktopStyles.bottle1} />
              <View style={desktopStyles.paper1} />
              <View style={desktopStyles.bottle2} />
            </View>
            
            {/* Trash Can */}
            <View style={desktopStyles.trashCan}>
              <View style={desktopStyles.canBody} />
              <View style={desktopStyles.biohazardSymbol} />
            </View>
          </View>
        </View>

        {/* Right Panel - Login Form */}
        <View style={desktopStyles.rightPanel}>
          <Text style={desktopStyles.welcomeText}>Welcome back, Admin</Text>
          
          <View style={desktopStyles.form}>
            {/* Username Field */}
            <AdminInput
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              icon="person"
            />
            
            {/* Password Field */}
            <AdminInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              icon="key"
              secureTextEntry
              rightComponent={
                <TouchableOpacity style={desktopStyles.forgotPassword}>
                  <Text style={desktopStyles.forgotPasswordText}>Forgot password?</Text>
                </TouchableOpacity>
              }
            />
            
            {/* Keep me logged in checkbox */}
            <View style={desktopStyles.checkboxContainer}>
              <TouchableOpacity
                style={[desktopStyles.checkbox, keepLoggedIn && desktopStyles.checkboxChecked]}
                onPress={() => setKeepLoggedIn(!keepLoggedIn)}
              >
                {keepLoggedIn && <Ionicons name="checkmark" size={18} color="white" />}
              </TouchableOpacity>
              <Text style={desktopStyles.checkboxText}>Keep me logged in</Text>
            </View>
            
            {/* Login Button */}
            <AdminButton title="Login" onPress={handleLogin} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
} 