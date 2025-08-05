import AuthApp from './components/components/AuthApp';

export default function App() {
  const [apiKey, setApiKey] = useState(null);
  useEffect(() => {
    fetch('http://localhost:8000/api/maps-key')
      .then((res) => res.json())
      .then((data) => setApiKey(data.apiKey));
  }, []);
  if (!apiKey) return <View><Text>Loading API key...</Text></View>;
  return <AuthApp apiKey={apiKey} />;
}