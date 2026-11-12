import { AuthProvider } from './context';
import { AppRoutes } from './routes/AppRoutes';
import './App.css';
import './brand.css';

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
