import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Admin } from "./pages/Admin";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import { BookPage } from "./pages/BookPage";
import { Catalog } from "./pages/Catalog";
import { Shelf } from "./pages/Shelves";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Catalog />} />
        <Route path="books/:id" element={<BookPage />} />
        <Route path="library" element={<Shelf kind="library" />} />
        <Route path="favorites" element={<Shelf kind="favorites" />} />
        <Route path="admin" element={<Admin />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
