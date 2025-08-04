import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminButton from '../../components/admin/AdminButton';
import AdminInput from '../../components/admin/AdminInput';

const { width, height } = Dimensions.get('window');

export default function AdminLoginMobileVertical() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  const handleLogin = () => {
    // TODO: Implement login logic
    console.log('Login attempt:', { username, password, keepLoggedIn });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Panel - Illustration */}
      <View style={styles.illustrationPanel}>
        <View style={styles.illustration}>
          {/* Sky */}
          <View style={styles.sky} />
          
          {/* Hills */}
          <View style={styles.hills}>
            <View style={styles.hill1} />
            <View style={styles.hill2} />
          </View>
          
          {/* Trees */}
          <View style={styles.trees}>
            <View style={styles.tree1} />
            <View style={styles.tree2} />
            <View style={styles.tree3} />
          </View>
          
          {/* City Buildings */}
          <View style={styles.cityBuildings}>
            <View style={styles.building1} />
            <View style={styles.building2} />
            <View style={styles.building3} />
          </View>
          
          {/* Characters */}
          <View style={styles.characters}>
            {/* Person 1 - Sweeping */}
            <View style={styles.person1}>
              <View style={styles.head1} />
              <View style={styles.body1} />
              <View style={styles.arm1} />
              <View style={styles.broom} />
            </View>
            
            {/* Person 2 - Holding bag */}
            <View style={styles.person2}>
              <View style={styles.head2} />
              <View style={styles.body2} />
              <View style={styles.arm2} />
              <View style={styles.bag} />
            </View>
            
            {/* Person 3 - Holding bottle */}
            <View style={styles.person3}>
              <View style={styles.head3} />
              <View style={styles.body3} />
              <View style={styles.arm3} />
              <View style={styles.bottle} />
            </View>
          </View>
          
          {/* Trash Items */}
          <View style={styles.trashItems}>
            <View style={styles.bottle1} />
            <View style={styles.paper1} />
            <View style={styles.bottle2} />
          </View>
          
          {/* Trash Can */}
          <View style={styles.trashCan}>
            <View style={styles.canBody} />
            <View style={styles.biohazardSymbol} />
          </View>
        </View>
      </View>

      {/* Bottom Panel - Login Form */}
      <View style={styles.formPanel}>
        <Text style={styles.welcomeText}>Welcome back, Admin</Text>
        
        <View style={styles.form}>
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
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            }
          />
          
          {/* Keep me logged in checkbox */}
          <View style={styles.checkboxContainer}>
            <TouchableOpacity
              style={[styles.checkbox, keepLoggedIn && styles.checkboxChecked]}
              onPress={() => setKeepLoggedIn(!keepLoggedIn)}
            >
              {keepLoggedIn && <Ionicons name="checkmark" size={16} color="white" />}
            </TouchableOpacity>
            <Text style={styles.checkboxText}>Keep me logged in</Text>
          </View>
          
          {/* Login Button */}
          <AdminButton title="Login" onPress={handleLogin} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8F5E8',
  },
  illustrationPanel: {
    flex: 0.6,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formPanel: {
    flex: 0.4,
    backgroundColor: '#E8F5E8',
    padding: 30,
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E8B57',
    marginBottom: 30,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#2E8B57',
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2E8B57',
  },
  checkboxText: {
    fontSize: 14,
    color: '#333',
  },
  forgotPassword: {
    marginLeft: 'auto',
  },
  forgotPasswordText: {
    fontSize: 12,
    color: '#999',
  },
  // Illustration styles
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
    height: '40%',
    backgroundColor: '#87CEEB',
  },
  hills: {
    position: 'absolute',
    bottom: '20%',
    left: 0,
    right: 0,
    height: '30%',
  },
  hill1: {
    position: 'absolute',
    bottom: 0,
    left: -50,
    right: -50,
    height: 80,
    backgroundColor: '#90EE90',
    borderRadius: 100,
  },
  hill2: {
    position: 'absolute',
    bottom: 0,
    left: 50,
    right: 50,
    height: 60,
    backgroundColor: '#98FB98',
    borderRadius: 100,
  },
  trees: {
    position: 'absolute',
    bottom: '25%',
    left: 0,
    right: 0,
    height: '25%',
  },
  tree1: {
    position: 'absolute',
    bottom: 0,
    left: '20%',
    width: 30,
    height: 60,
    backgroundColor: '#228B22',
    borderRadius: 15,
  },
  tree2: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    width: 25,
    height: 50,
    backgroundColor: '#32CD32',
    borderRadius: 12,
  },
  tree3: {
    position: 'absolute',
    bottom: 0,
    left: '70%',
    width: 35,
    height: 70,
    backgroundColor: '#228B22',
    borderRadius: 17,
  },
  cityBuildings: {
    position: 'absolute',
    bottom: '30%',
    left: '10%',
    height: '20%',
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  building1: {
    width: 20,
    height: 40,
    backgroundColor: '#696969',
    marginRight: 5,
  },
  building2: {
    width: 25,
    height: 60,
    backgroundColor: '#808080',
    marginRight: 5,
  },
  building3: {
    width: 30,
    height: 50,
    backgroundColor: '#A9A9A9',
  },
  characters: {
    position: 'absolute',
    bottom: '15%',
    left: 0,
    right: 0,
    height: '30%',
  },
  person1: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    alignItems: 'center',
  },
  head1: {
    width: 20,
    height: 20,
    backgroundColor: '#FFB6C1',
    borderRadius: 10,
  },
  body1: {
    width: 30,
    height: 40,
    backgroundColor: '#4169E1',
    borderRadius: 5,
  },
  arm1: {
    position: 'absolute',
    right: -10,
    top: 10,
    width: 15,
    height: 8,
    backgroundColor: '#FFB6C1',
    borderRadius: 4,
  },
  broom: {
    position: 'absolute',
    right: -25,
    top: 5,
    width: 30,
    height: 4,
    backgroundColor: '#4169E1',
    borderRadius: 2,
  },
  person2: {
    position: 'absolute',
    bottom: 0,
    left: '45%',
    alignItems: 'center',
  },
  head2: {
    width: 18,
    height: 18,
    backgroundColor: '#8B4513',
    borderRadius: 9,
  },
  body2: {
    width: 25,
    height: 35,
    backgroundColor: '#FF0000',
    borderRadius: 5,
  },
  arm2: {
    position: 'absolute',
    right: -15,
    top: 8,
    width: 12,
    height: 6,
    backgroundColor: '#FFB6C1',
    borderRadius: 3,
  },
  bag: {
    position: 'absolute',
    right: -25,
    top: 5,
    width: 20,
    height: 25,
    backgroundColor: '#808080',
    borderRadius: 3,
  },
  person3: {
    position: 'absolute',
    bottom: 0,
    left: '70%',
    alignItems: 'center',
  },
  head3: {
    width: 22,
    height: 22,
    backgroundColor: '#8B4513',
    borderRadius: 11,
  },
  body3: {
    width: 28,
    height: 38,
    backgroundColor: '#87CEEB',
    borderRadius: 5,
  },
  arm3: {
    position: 'absolute',
    right: -12,
    top: 10,
    width: 14,
    height: 7,
    backgroundColor: '#8B4513',
    borderRadius: 3,
  },
  bottle: {
    position: 'absolute',
    right: -20,
    top: 8,
    width: 8,
    height: 15,
    backgroundColor: '#32CD32',
    borderRadius: 4,
  },
  trashItems: {
    position: 'absolute',
    bottom: '10%',
    left: 0,
    right: 0,
    height: '10%',
  },
  bottle1: {
    position: 'absolute',
    bottom: 0,
    left: '25%',
    width: 6,
    height: 12,
    backgroundColor: '#32CD32',
    borderRadius: 3,
  },
  paper1: {
    position: 'absolute',
    bottom: 0,
    left: '35%',
    width: 8,
    height: 6,
    backgroundColor: '#F5F5DC',
    borderRadius: 2,
  },
  bottle2: {
    position: 'absolute',
    bottom: 0,
    left: '65%',
    width: 5,
    height: 10,
    backgroundColor: '#FF6347',
    borderRadius: 2,
  },
  trashCan: {
    position: 'absolute',
    bottom: '5%',
    left: '50%',
    alignItems: 'center',
  },
  canBody: {
    width: 30,
    height: 40,
    backgroundColor: '#808080',
    borderRadius: 5,
  },
  biohazardSymbol: {
    position: 'absolute',
    top: 5,
    width: 20,
    height: 20,
    backgroundColor: '#FF0000',
    borderRadius: 10,
  },
}); 