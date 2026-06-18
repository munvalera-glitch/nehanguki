import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ImmigrationMVP from "./ImmigrationMVP";
import ArticlesList from "./articles/ArticlesList";
import ArticlePage from "./articles/ArticlePage";
import JapanVisaMVP from "./JapanVisaMVP";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ImmigrationMVP />} />
        <Route path="/japan" element={<JapanVisaMVP />} />
        
        {/* Russian Articles */}
        <Route path="/articles" element={<ArticlesList lang="ru" />} />
        <Route path="/articles/:slug" element={<ArticlePage lang="ru" />} />
        
        {/* English Articles */}
        <Route path="/en/articles" element={<ArticlesList lang="en" />} />
        <Route path="/en/articles/:slug" element={<ArticlePage lang="en" />} />
      </Routes>
    </Router>
  );
}