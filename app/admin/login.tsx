import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdminButton from '../../components/admin/AdminButton';
import AdminInput from '../../components/admin/AdminInput';
import { adminStyles } from '../../styles/admin';

const { width, height } = Dimensions.get('window');

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  const handleLogin = () => {
    // TODO: Implement login logic
    console.log('Login attempt:', { username, password, keepLoggedIn });
  };

  return (
    <SafeAreaView style={adminStyles.container}>
      <View style={adminStyles.mainCard}>
        {/* Left Panel - Illustration */}
        <View style={adminStyles.leftPanel}>
          <View style={adminStyles.illustration}>
            {/* Sky */}
            <View style={adminStyles.sky} />
            
            {/* Hills */}
            <View style={adminStyles.hills}>
              <View style={adminStyles.hill1} />
              <View style={adminStyles.hill2} />
            </View>
            
            {/* Trees */}
            <View style={adminStyles.trees}>
              <View style={adminStyles.tree1} />
              <View style={adminStyles.tree2} />
              <View style={adminStyles.tree3} />
            </View>
            
            {/* City Buildings */}
            <View style={adminStyles.cityBuildings}>
              <View style={adminStyles.building1} />
              <View style={adminStyles.building2} />
              <View style={adminStyles.building3} />
            </View>
            
            {/* Characters */}
            <View style={adminStyles.characters}>
              {/* Person 1 - Sweeping */}
              <View style={adminStyles.person1}>
                <View style={adminStyles.head1} />
                <View style={adminStyles.body1} />
                <View style={adminStyles.arm1} />
                <View style={adminStyles.broom} />
              </View>
              
              {/* Person 2 - Holding bag */}
              <View style={adminStyles.person2}>
                <View style={adminStyles.head2} />
                <View style={adminStyles.body2} />
                <View style={adminStyles.arm2} />
                <View style={adminStyles.bag} />
              </View>
              
              {/* Person 3 - Holding bottle */}
              <View style={adminStyles.person3}>
                <View style={adminStyles.head3} />
                <View style={adminStyles.body3} />
                <View style={adminStyles.arm3} />
                <View style={adminStyles.bottle} />
              </View>
            </View>
            
            {/* Trash Items */}
            <View style={adminStyles.trashItems}>
              <View style={adminStyles.bottle1} />
              <View style={adminStyles.paper1} />
              <View style={adminStyles.bottle2} />
            </View>
            
            {/* Trash Can */}
            <View style={adminStyles.trashCan}>
              <View style={adminStyles.canBody} />
              <View style={adminStyles.biohazardSymbol} />
            </View>
          </View>
        </View>

        {/* Right Panel - Login Form */}
        <View style={adminStyles.rightPanel}>
          <Text style={adminStyles.welcomeText}>Welcome back, Admin</Text>
          
          <View style={adminStyles.form}>
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
                <TouchableOpacity style={adminStyles.forgotPassword}>
                  <Text style={adminStyles.forgotPasswordText}>Forgot password?</Text>
                </TouchableOpacity>
              }
            />
            
            {/* Keep me logged in checkbox */}
            <View style={adminStyles.checkboxContainer}>
              <TouchableOpacity
                style={[adminStyles.checkbox, keepLoggedIn && adminStyles.checkboxChecked]}
                onPress={() => setKeepLoggedIn(!keepLoggedIn)}
              >
                {keepLoggedIn && <Ionicons name="checkmark" size={16} color="white" />}
              </TouchableOpacity>
              <Text style={adminStyles.checkboxText}>Keep me logged in</Text>
            </View>
            
            {/* Login Button */}
            <AdminButton title="Login" onPress={handleLogin} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

 