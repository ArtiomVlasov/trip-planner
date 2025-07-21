// MobileMapStyles.js
import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  app: {
    flex: 1,
    padding: 10,
  },
  messages: {
    flex: 1,
    marginBottom: 10,
  },
  messageBubble: {
    backgroundColor: '#eee',
    borderRadius: 10,
    padding: 10,
    maxWidth: '80%',
  },
  messageText: {
    fontSize: 16,
  },
  toggleBtn: {
    marginTop: 5,
  },
  mapContainer: {
    height: 200,
    marginTop: 10,
  },
  map: {
    flex: 1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginRight: 10,
  },
});