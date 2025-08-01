import { StyleSheet } from 'react-native';

export const adminStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainCard: {
    width: '90%',
    height: '80%',
    backgroundColor: '#E8F5E8',
    borderRadius: 20,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  
  // Panel styles
  leftPanel: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightPanel: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    padding: 40,
    justifyContent: 'center',
  },
  
  // Form styles
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E8B57',
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
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