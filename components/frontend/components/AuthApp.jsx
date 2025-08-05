// components/frontend/components/AuthApp.jsx
import React, { useState } from 'react';
import { View, Text, TextInput, Button, TouchableOpacity, Modal, StyleSheet, Platform, ScrollView } from 'react-native';
import MapComponent from '../maps/MapComponent'; // Your existing chat+map component

const questionnaireFields = [
  { key: 'maxWalkingDistanceMeters', label: 'Max Walking Distance (meters)', type: 'number' },
  { key: 'preferredTypes', label: 'Preferred Types (comma separated, e.g. restaurant, museum)', type: 'text' },
  { key: 'budgetLevel', label: 'Budget Level', type: 'text' },
  { key: 'ratingThreshold', label: 'Minimum Rating', type: 'number' },
  { key: 'likesBreakfastOutside', label: 'Likes Breakfast Outside?', type: 'boolean' },
  { key: 'transportMode', label: 'Transport Mode', type: 'text' },
  { key: 'availabilityStartTime', label: 'Availability Start Time (e.g. 09:00)', type: 'text' },
  { key: 'availabilityEndTime', label: 'Availability End Time (e.g. 18:00)', type: 'text' },
];

export default function AuthApp({ apiKey }) {
  const [screen, setScreen] = useState('landing'); // landing | login | signup | questionnaire | chat
  const [login, setLogin] = useState({ username: '', password: '' });
  const [signup, setSignup] = useState({ name: '', email: '', password: '' });
  const [questionnaire, setQuestionnaire] = useState({});
  const [questionStep, setQuestionStep] = useState(0);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState('');

  // Handlers
  const handleLogin = async () => {
    // TODO: Replace with your real login endpoint
    // For now, just simulate login
    if (login.username && login.password) {
      setScreen('chat');
      setUserId(login.username);
    } else {
      setError('Please enter username and password');
    }
  };

  const handleSignup = async () => {
    if (!signup.name || !signup.email || !signup.password) {
      setError('Please fill all fields');
      return;
    }
    // Call your /register endpoint
    try {
      const res = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signup),
      });
      const data = await res.json();
      if (data.user_id || data.userId) {
        setUserId(data.user_id || data.userId);
        setScreen('questionnaire');
        setQuestionStep(0);
      } else {
        setError('Registration failed');
      }
    } catch (e) {
      setError('Registration error');
    }
  };

  const handleQuestionnaireNext = () => {
    if (questionStep < questionnaireFields.length - 1) {
      setQuestionStep(questionStep + 1);
    } else {
      // Submit questionnaire (optional: send to backend)
      setScreen('chat');
    }
  };

  const handleQuestionnaireChange = (value) => {
    setQuestionnaire({
      ...questionnaire,
      [questionnaireFields[questionStep].key]: value,
    });
  };

  // UI
  if (screen === 'chat') {
    return <MapComponent apiKey={apiKey} userId={userId} />;
  }

  return (
    <View style={styles.container}>
      {/* Top-right buttons */}
      <View style={styles.topRight}>
        <TouchableOpacity onPress={() => { setScreen('login'); setError(''); }}>
          <Text style={styles.topButton}>Log In</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setScreen('signup'); setError(''); }}>
          <Text style={styles.topButton}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      {/* Main content */}
      {screen === 'landing' && (
        <View style={styles.centered}>
          <Text style={styles.title}>Trip Planner</Text>
          <Text style={styles.subtitle}>Plan your perfect trip with AI-powered recommendations!</Text>
        </View>
      )}

      {/* Login Modal */}
      {screen === 'login' && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Log In</Text>
              <TextInput
                placeholder="Username"
                value={login.username}
                onChangeText={t => setLogin({ ...login, username: t })}
                style={styles.input}
              />
              <TextInput
                placeholder="Password"
                value={login.password}
                onChangeText={t => setLogin({ ...login, password: t })}
                style={styles.input}
                secureTextEntry
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button title="Log In" onPress={handleLogin} />
              <Button title="Cancel" onPress={() => setScreen('landing')} />
            </View>
          </View>
        </Modal>
      )}

      {/* Signup Modal */}
      {screen === 'signup' && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Sign Up</Text>
              <TextInput
                placeholder="Name"
                value={signup.name}
                onChangeText={t => setSignup({ ...signup, name: t })}
                style={styles.input}
              />
              <TextInput
                placeholder="Email"
                value={signup.email}
                onChangeText={t => setSignup({ ...signup, email: t })}
                style={styles.input}
                keyboardType="email-address"
              />
              <TextInput
                placeholder="Password"
                value={signup.password}
                onChangeText={t => setSignup({ ...signup, password: t })}
                style={styles.input}
                secureTextEntry
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button title="Sign Up" onPress={handleSignup} />
              <Button title="Cancel" onPress={() => setScreen('landing')} />
            </View>
          </View>
        </Modal>
      )}

      {/* Questionnaire Modal */}
      {screen === 'questionnaire' && (
        <Modal visible transparent animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Questionnaire</Text>
              <Text>{questionnaireFields[questionStep].label}</Text>
              <TextInput
                placeholder={questionnaireFields[questionStep].label}
                value={questionnaire[questionnaireFields[questionStep].key] || ''}
                onChangeText={handleQuestionnaireChange}
                style={styles.input}
                keyboardType={questionnaireFields[questionStep].type === 'number' ? 'numeric' : 'default'}
              />
              <Button
                title={questionStep < questionnaireFields.length - 1 ? 'Next' : 'Finish'}
                onPress={handleQuestionnaireNext}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topRight: {
    position: 'absolute',
    top: 40,
    right: 20,
    flexDirection: 'row',
    zIndex: 10,
  },
  topButton: {
    marginLeft: 20,
    fontWeight: 'bold',
    color: '#007AFF',
    fontSize: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 18, color: '#555', textAlign: 'center', marginBottom: 20 },
  modalContainer: {
    flex: 1,
    backgroundColor: '#00000099',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: 320,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 24,
    alignItems: 'stretch',
    elevation: 5,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    fontSize: 16,
  },
  error: { color: 'red', marginBottom: 8, textAlign: 'center' },
});
