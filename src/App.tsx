import React, { useState, useEffect } from "react";
import {
  LayoutDashboard, PlusCircle, History, Settings, FileSpreadsheet, Upload, Trash2, Download, ChevronRight,
  CheckCircle2, AlertCircle, Loader2, Search, Filter, ArrowUpDown, FileText, Layers, Save, Plus, X, ChevronDown, ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const API_URL = import.meta.env.VITE_API_URL || "https://integrare-api.onrender.com";

// --- Types ---

interface Pavimento {
  id: string;
  name: string;
  files: File[];
}

interface Project {
  id?: number;
  name: string;
  client: string;
  code?: string;
  revision: string;
  project_date: string;
  observations?: string;
  unification_mode: 'global' | 'system';
  total_processado: number;
  total_consolidado: number;
  total_duplicatas: number;
  processing_time: number;
  dados_json: any;
  created_at?: string;
}

interface ProcessingStats {
  totalLines: number;
  consolidatedLines: number;
  duplicatesFound: number;
  processingTime: number;
}

interface MaterialItem {
  description: string;
  dimension: string;
  unit: string;
  quantity: number;
}

interface SystemResults {
  pavimentos: Record<string, MaterialItem[]>;
  total: MaterialItem[];
}

type ResultsData = MaterialItem[] | SystemResults;

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button onClick={onClick} className={`sidebar-item ${active ? 'active' : ''}`}>
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

const Toast = ({ message, type }: { message: string; type: 'success' | 'error' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 20 }}
    className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full"
    style={{
      backgroundColor: "var(--bg-secondary)",
      border: "1px solid var(--border-color)"
    }}
  >
    <span style={{ letterSpacing: "0.1em", fontSize: "12px" }}>
      {message}
    </span>
  </motion.div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Partial<Project>>({
    name: "", client: "", code: "", revision: "R00", unification_mode: "global", project_date: new Date().toISOString().split('T')[0]
  });
  const [pavimentos, setPavimentos] = useState<Pavimento[]>([
    { id: Math.random().toString(36).substr(2, 9), name: "Térreo", files: [] }
  ]);
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState("");
  const [results, setResults] = useState<ResultsData | null>(null);
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [expandedPavs, setExpandedPavs] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchProjects(); }, []);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved) setTheme(saved as 'light' | 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects`);
      const data = await res.json();
      setProjects(data);
    } catch (err) { showToast("Erro ao carregar projetos", "error"); }
  };

  const isSystemResults = (data: ResultsData): data is SystemResults => {
    return (data as SystemResults).pavimentos !== undefined;
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const addPavimento = () => {
    setPavimentos([...pavimentos, { id: Math.random().toString(36).substr(2, 9), name: "", files: [] }]);
  };

  const removePavimento = (id: string) => {
    setPavimentos(pavimentos.filter(p => p.id !== id));
  };

  const updatePavimentoName = (id: string, name: string) => {
    setPavimentos(pavimentos.map(p => p.id === id ? { ...p, name } : p));
  };

  const validateFiles = (files: FileList): { valid: File[], errors: string[] } => {
    const valid: File[] = [];
    const errors: string[] = [];
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const maxFileSize = 50 * 1024 * 1024;

    Array.from(files).forEach(file => {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!validExtensions.includes(fileExtension)) {
        errors.push(`${file.name}: Tipo de arquivo invalido. Use .xlsx, .xls ou .csv`);
      } else if (file.size > maxFileSize) {
        errors.push(`${file.name}: Arquivo muito grande. Maximo 50MB.`);
      } else {
        valid.push(file);
      }
    });
    return { valid, errors };
  };

  const resetProjectForm = () => {
    setCurrentProject({
      name: "",
      client: "",
      code: "",
      revision: "R00",
      unification_mode: "global",
      project_date: new Date().toISOString().split("T")[0]
    });

    setPavimentos([
      {
        id: Math.random().toString(36).substr(2, 9),
        name: "Térreo",
        files: []
      }
    ]);

    setResults(null);
    setStats(null);
    setSearchTerm("");
  };

  const handleFileAdd = (id: string, newFiles: FileList | null) => {
    if (!newFiles) return;
    const { valid, errors } = validateFiles(newFiles);
    if (errors.length > 0) {
      errors.forEach(err => showToast(err, "error"));
    }
    if (valid.length > 0) {
      setPavimentos(pavimentos.map(p => p.id === id ? { ...p, files: [...p.files, ...valid] } : p));
    }
  };

  const handleDrop = (pavId: string, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();

    const files = Array.from(e.dataTransfer.files) as File[];

    const csvFiles = files.filter((file: File) =>
      file.name.toLowerCase().endsWith(".csv")
    );

    if (csvFiles.length === 0) {
      showToast("Apenas arquivos CSV são permitidos", "error");
      return;
    }

    const dataTransfer = new DataTransfer();

    csvFiles.forEach(file => dataTransfer.items.add(file));

    handleFileAdd(pavId, dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (pavId: string, fileIdx: number) => {
    setPavimentos(pavimentos.map(p => p.id === pavId ? { ...p, files: p.files.filter((_, i) => i !== fileIdx) } : p));
  };

  const handleProcess = async () => {
    if (!currentProject.name || !currentProject.client) return showToast("Preencha o nome do projeto e cliente", "error");
    if (pavimentos.some(p => !p.name.trim())) return showToast("Dê um nome para todos os pavimentos", "error");
    if (pavimentos.some(p => p.files.length === 0)) return showToast("Adicione pelo menos um arquivo em cada pavimento", "error");

    const formData = new FormData();
    pavimentos.forEach(pav => {
      pav.files.forEach(file => formData.append(`files_${pav.id}`, file));
    });
    formData.append('mode', currentProject.unification_mode || 'global');
    formData.append('pavimentosMetadata', JSON.stringify(pavimentos.map(p => ({ id: p.id, name: p.name }))));

    console.log("Sending process request...", {
      mode: currentProject.unification_mode,
      pavimentos: pavimentos.map(p => ({ name: p.name, filesCount: p.files.length }))
    });

    setProcessing(true);
    setProcessStep("Lendo arquivos...");
    try {
      setTimeout(() => setProcessStep("Normalizando dados..."), 800);
      setTimeout(() => setProcessStep("Agrupando materiais..."), 1600);

      const res = await fetch(`${API_URL}/api/process`, {
        method: "POST",
        body: formData
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response:", text);
        throw new Error(`Erro do servidor: O servidor nao retornou JSON valido. Verifique se esta rodando.`);
      }

      const data = await res.json();
      if (!res.ok) {
        const errorMsg = data.error || `Erro no processamento (HTTP ${res.status})`;
        throw new Error(errorMsg);
      }

      setResults(data.data);
      setStats(data.stats);
      setActiveTab("results");
      showToast("Processamento concluído!", "success");
    } catch (err: any) {
      console.error("Process error:", err);
      showToast(err.message, "error");
    } finally {
      setProcessing(false);
      setProcessStep("");
    }
  };

  const handleSaveProject = async () => {
    try {
      if (!results || !stats) {
        showToast("Processe um projeto primeiro", "error");
        return;
      }
      const payload = { ...currentProject, total_processado: stats?.totalLines, total_consolidado: stats?.consolidatedLines, total_duplicatas: stats?.duplicatesFound, processing_time: stats?.processingTime, dados_json: results, pavimentos: pavimentos.map(p => ({ name: p.name })) };
      const res = await fetch(`${API_URL}/api/projects/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error("Erro ao salvar");
      showToast("Projeto salvo com sucesso!", "success");
      fetchProjects();
      setActiveTab("history");
    } catch (err: any) {
      showToast(err.message || "Erro ao salvar", "error");
    }
  };

  const handleExport = async (format: 'docx' | 'xlsx') => {
    try {
      const res = await fetch(`${API_URL}/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: currentProject,
          data: results
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Erro backend:", errorText);
        throw new Error("Erro ao gerar arquivo");
      }

      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RM - ${currentProject.name} - ${currentProject.revision}.${format}`;

      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      showToast("Erro ao exportar", "error");
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm("Excluir projeto?")) return;
    try {
      await fetch(`${API_URL}/api/projects/${id}`, { method: "DELETE" });
      showToast("Excluído", "success");
      fetchProjects();
    } catch (err) { showToast("Erro ao excluir", "error"); }
  };

  const handleViewProject = (project: Project) => {
    setCurrentProject(project);
    const parsed = typeof project.dados_json === "string"
      ? JSON.parse(project.dados_json)
      : project.dados_json;

    setResults(parsed);
    setStats({ totalLines: project.total_processado, consolidatedLines: project.total_consolidado, duplicatesFound: project.total_duplicatas, processingTime: project.processing_time });
    setActiveTab("results");
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortedData = (data: any[]) => {
    if (!sortConfig) return data;
    return [...data].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const renderTable = (data: MaterialItem[]) => {
    const filtered = data.filter(item =>
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.dimension?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const sorted = getSortedData(filtered);
    return (
      <div className="overflow-x-auto rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <table className="w-full text-left border-collapse">
          <thead style={{ backgroundColor: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
            <tr>
              <th className="p-4 text-xs font-semibold text-secondary uppercase cursor-pointer hover:text-white" onClick={() => handleSort('description')}><div className="flex items-center gap-2">Descrição <ArrowUpDown size={14} /></div></th>
              <th className="p-4 text-xs font-semibold text-secondary uppercase cursor-pointer hover:text-white" onClick={() => handleSort('dimension')}><div className="flex items-center gap-2">Dimensão <ArrowUpDown size={14} /></div></th>
              <th className="p-4 text-xs font-semibold text-secondary uppercase cursor-pointer hover:text-white" onClick={() => handleSort('unit')}><div className="flex items-center gap-2">Unidade <ArrowUpDown size={14} /></div></th>
              <th className="p-4 text-xs font-semibold text-secondary uppercase text-right cursor-pointer hover:text-white" onClick={() => handleSort('quantity')}><div className="flex items-center justify-end gap-2">Qtd <ArrowUpDown size={14} /></div></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((item, idx) => (
              <tr key={idx} className="hover:bg-white/5 transition-colors">
                <td className="p-4 text-[#F5F7FA] font-medium">{item.description}</td>
                <td className="p-4 text-secondary">{item.dimension}</td>
                <td className="p-4" style={{ color: "var(--text-secondary)" }}>{item.unit}</td>
                <td className="p-4 text-[#F5F7FA] text-right font-mono">{item.quantity.toLocaleString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      className="flex min-h-screen font-sans transition-colors duration-500"
      style={{ color: "var(--text-primary)" }}>
      <aside
        className="w-72 flex flex-col p-8" style={{ backgroundColor: "var(--bg-secondary)", borderRight: "1px solid var(--border-color)" }}>
        <div className="flex items-center gap-4 mb-16 px-2">
          <div className="w-10 h-10 flex items-center justify-center" style={{ border: "1px solid var(--border-color)" }}>
            <span style={{ letterSpacing: "0.2em", fontSize: "12px" }}>IN</span>
          </div>
          <div><h1 style={{ letterSpacing: "0.35em", fontWeight: 300 }}>INTEGRARE</h1><p className="text-[10px] text-secondary uppercase tracking-[0.2em] font-semibold">Arquitetura Estratégica</p></div>
        </div>
        <div className="mt-12 pt-6 border-t border-white/10" style={{ borderColor: "var(--border-color)" }}>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full py-3 rounded-xl text-xs font-semibold transition-all"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              letterSpacing: "0.25em"
            }}
          >
            {theme === "dark" ? "ATIVAR LIGHT MODE" : "ATIVAR DARK MODE"}
          </button>
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} />
          <SidebarItem icon={PlusCircle} label="Novo Projeto" active={activeTab === "new-project"} onClick={() => { resetProjectForm(); setActiveTab("new-project"); }} />
          <SidebarItem icon={History} label="Histórico" active={activeTab === "history"} onClick={() => setActiveTab("history")} />
          <SidebarItem icon={Settings} label="Configurações" active={activeTab === "config"} onClick={() => setActiveTab("config")} />
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-10">
        <AnimatePresence mode="wait">
          {activeTab === "dashboard" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} key="dashboard">
              <header className="mb-10"><h2 className="text-3xl font-bold mb-2">Dashboard</h2><p className="text-secondary">Acompanhe seus projetos recentes.</p></header>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div
                  className="p-8 rounded-2xl transition-all"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)"
                  }}
                ><p className="text-sm text-secondary mb-2 uppercase font-semibold">Projetos</p><p className="text-4xl font-bold">{projects.length}</p></div>
                <div
                  className="p-8 rounded-2xl transition-all"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)"
                  }}
                ><p className="text-sm text-secondary mb-2 uppercase font-semibold">Consolidados</p><p className="text-4xl font-bold">{projects.reduce((acc, p) => acc + p.total_consolidado, 0).toLocaleString()}</p></div>
                <div
                  className="p-8 rounded-2xl transition-all"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)"
                  }}
                ><p className="text-sm text-emerald-400 mb-2 uppercase font-semibold">Duplicatas</p><p className="text-4xl font-bold text-emerald-400">{projects.reduce((acc, p) => acc + p.total_duplicatas, 0).toLocaleString()}</p></div>
              </div>
              <div className="glass-card overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center"><h3 className="font-bold">Projetos Recentes</h3></div>
                <table className="w-full text-left">
                  <thead className="bg-white/5"><tr><th className="p-4 text-xs font-semibold text-secondary uppercase">Projeto</th><th className="p-4 text-xs font-semibold text-secondary uppercase">Cliente</th><th className="p-4 text-xs font-semibold text-secondary uppercase text-right">Ações</th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {projects.slice(0, 5).map(p => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors"><td className="p-4 font-medium">{p.name} <span className="text-[10px] px-2 py-1 rounded" style={{ border: "1px solid var(--border-color)", letterSpacing: "0.15em" }}>{p.revision}</span></td><td className="p-4 text-secondary">{p.client}</td><td className="p-4 text-right"><button onClick={() => handleViewProject(p)} className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm">Visualizar</button></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === "new-project" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} key="new-project" className="max-w-4xl mx-auto">
              <header className="mb-10 text-center"><h2 className="text-3xl font-bold mb-2">Novo Projeto</h2><p className="text-secondary">Organize por pavimentos e faça o upload das planilhas.</p></header>
              <div className="space-y-12">
                <section
                  className="p-10 rounded-2xl"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)"
                  }}
                >
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">1</div> Informações Gerais</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2"><label className="text-xs font-semibold text-secondary uppercase">Nome do Projeto</label><input type="text" className="input-field" value={currentProject.name} onChange={e => setCurrentProject({ ...currentProject, name: e.target.value })} /></div>
                    <div className="space-y-2"><label className="text-xs font-semibold text-secondary uppercase">Cliente</label><input type="text" className="input-field" value={currentProject.client} onChange={e => setCurrentProject({ ...currentProject, client: e.target.value })} /></div>
                    <div className="space-y-2"><label className="text-xs font-semibold text-secondary uppercase">Código</label><input type="text" className="input-field" value={currentProject.code} onChange={e => setCurrentProject({ ...currentProject, code: e.target.value })} /></div>
                    <div className="space-y-2"><label className="text-xs font-semibold text-secondary uppercase">Revisão</label><select className="input-field" value={currentProject.revision} onChange={e => setCurrentProject({ ...currentProject, revision: e.target.value })}><option value="R00">R00</option><option value="R01">R01</option><option value="R02">R02</option></select></div>
                  </div>
                </section>

                <section
                  className="p-10 rounded-2xl"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)"
                  }}
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">2</div> Pavimentos</h3>
                    <button onClick={addPavimento} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-lg text-sm font-bold"><Plus size={18} /> Adicionar Pavimento</button>
                  </div>
                  <div className="space-y-4">
                    {pavimentos.map((pav, pIdx) => (
                      <div key={pav.id} className="border border-white/10 rounded-xl overflow-hidden bg-white/5">
                        <div className="p-4 flex items-center gap-4 border-b border-white/5">
                          <button onClick={() => setExpandedPavs({ ...expandedPavs, [pav.id]: !expandedPavs[pav.id] })} className="text-secondary">{expandedPavs[pav.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
                          <input type="text" className="bg-transparent border-none focus:ring-0 font-bold flex-1" placeholder="Nome do Pavimento (ex: Térreo)" value={pav.name} onChange={e => updatePavimentoName(pav.id, e.target.value)} />
                          <span className="text-xs text-secondary font-mono">{pav.files.length} arquivos</span>
                          <button onClick={() => removePavimento(pav.id)} className="text-rose-400 hover:text-rose-300"><Trash2 size={18} /></button>
                        </div>
                        <AnimatePresence>
                          {expandedPavs[pav.id] && (
                            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                              <div className="p-4 space-y-4">
                                <div className="grid grid-cols-1 gap-2">
                                  {pav.files.map((f, fIdx) => (
                                    <div key={fIdx} className="flex items-center justify-between p-2 bg-black/20 rounded-lg text-sm">
                                      <div className="flex items-center gap-2"><FileSpreadsheet size={16} className="text-emerald-500" /> <span>{f.name}</span></div>
                                      <button onClick={() => removeFile(pav.id, fIdx)} className="text-rose-400"><X size={14} /></button>
                                    </div>
                                  ))}
                                </div>
                                <div
                                  onClick={() => document.getElementById(`file-${pav.id}`)?.click()}
                                  onDrop={(e) => handleDrop(pav.id, e)}
                                  onDragOver={handleDragOver}
                                  className="border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:border-indigo-500/50 hover:bg-white/5 cursor-pointer transition-all"
                                >
                                  <input type="file" id={`file-${pav.id}`} className="hidden" multiple accept=".csv" onChange={e => handleFileAdd(pav.id, e.target.files)} />
                                  <Upload className="text-secondary" size={24} />
                                  <p className="text-[10px] uppercase font-bold text-secondary">Arraste arquivos CSV ou clique para selecionar</p>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </section>

                <section
                  className="p-10 rounded-2xl"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)"
                  }}
                >
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">3</div> Modo de Unificação</h3>
                  <div className="flex gap-4">
                    <button onClick={() => setCurrentProject({ ...currentProject, unification_mode: 'global' })} className={`flex-1 p-4 rounded-xl border transition-all text-left ${currentProject.unification_mode === 'global' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 bg-white/5'}`}><p className="font-bold mb-1">Unificação Global</p><p className="text-xs text-secondary">Lista única consolidada.</p></button>
                    <button onClick={() => setCurrentProject({ ...currentProject, unification_mode: 'system' })} className={`flex-1 p-4 rounded-xl border transition-all text-left ${currentProject.unification_mode === 'system' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 bg-white/5'}`}><p className="font-bold mb-1">Por Pavimento</p><p className="text-xs text-secondary">Blocos separados por pavimento.</p></button>
                  </div>
                </section>

                <div className="flex justify-center pt-6"><button disabled={processing} onClick={handleProcess} className="btn-primary px-12 py-4 text-lg flex items-center gap-3">{processing ? <><Loader2 className="animate-spin" /> <span>{processStep}</span></> : <><Layers /> <span>Processar Materiais</span></>}</button></div>
              </div>
            </motion.div>
          )}

          {activeTab === "results" && results && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key="results">
              <header className="mb-10 flex justify-between items-end">
                <div><h2 className="text-3xl font-bold mb-2">{currentProject.name} <span className="text-sm bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded ml-2">{currentProject.revision}</span></h2><p className="text-secondary">Cliente: {currentProject.client}</p></div>
                <div className="flex gap-3">
                  <button onClick={handleSaveProject} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-semibold"><Save size={18} /> Salvar</button>
                  <button onClick={() => handleExport('xlsx')} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-semibold"><FileSpreadsheet size={18} /> Excel</button>
                  <button onClick={() => handleExport('docx')} className="btn-primary px-6 py-2 text-sm flex items-center gap-2"><FileText size={18} /> Gerar DOCX</button>
                </div>
              </header>

              <div className="grid grid-cols-4 gap-6 mb-8">
                <div
                  className="p-6 rounded-2xl"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)"
                  }}
                ><p
                  className="text-[10px] uppercase font-semibold"
                  style={{
                    color: "var(--text-secondary)",
                    letterSpacing: "0.2em"
                  }}
                >Processado</p><p className="text-2xl font-bold">{stats?.totalLines}</p></div>
                <div
                  className="p-6 rounded-2xl"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)"
                  }}
                ><p
                  className="text-[10px] uppercase font-semibold"
                  style={{
                    color: "var(--text-secondary)",
                    letterSpacing: "0.2em"
                  }}
                >Consolidado</p><p className="text-2xl font-bold">{stats?.consolidatedLines}</p></div>
                <div
                  className="p-6 rounded-2xl"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)"
                  }}
                ><p className="text-[10px] text-emerald-400 uppercase font-bold">Duplicatas</p><p className="text-2xl font-bold text-emerald-400">{stats?.duplicatesFound}</p></div>
                <div
                  className="p-6 rounded-2xl"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-color)"
                  }}
                ><p
                  className="text-[10px] uppercase font-semibold"
                  style={{
                    color: "var(--text-secondary)",
                    letterSpacing: "0.2em"
                  }}
                >Tempo</p><p className="text-2xl font-bold">{stats?.processingTime.toFixed(2)}s</p></div>
              </div>

              <div className="mb-6 flex gap-4"><div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} /><input type="text" placeholder="Buscar..." className="input-field pl-12" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>

              <div className="space-y-10">
                {results && Array.isArray(results) && (
                  renderTable(results)
                )}

                {results && !Array.isArray(results) && isSystemResults(results) && (
                  <>
                    {Object.entries(results.pavimentos).map(([name, items]) => (
                      <section key={name}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                          <div
                            className="w-[2px] h-6"
                            style={{ backgroundColor: "var(--text-primary)", opacity: 0.4 }}
                          ></div>
                          PAVIMENTO: {name.toUpperCase()}
                        </h3>
                        {renderTable(items)}
                      </section>
                    ))}

                    <section>
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <div
                          className="w-[2px] h-6"
                          style={{ backgroundColor: "var(--text-primary)", opacity: 0.4 }}
                        ></div>
                        TOTAL GERAL CONSOLIDADO
                      </h3>
                      {renderTable(results.total)}
                    </section>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "history" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} key="history">
              <header className="mb-10"><h2 className="text-3xl font-bold mb-2">Histórico</h2></header>
              <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-white/5"><tr><th className="p-4 text-xs font-semibold text-secondary uppercase">Projeto</th><th className="p-4 text-xs font-semibold text-secondary uppercase">Cliente</th><th className="p-4 text-xs font-semibold text-secondary uppercase text-right">Ações</th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {projects.map(p => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                        <td className="p-4"><p className="font-bold">{p.name}</p><p className="text-[10px] text-secondary">{p.revision}</p></td>
                        <td className="p-4 text-secondary">{p.client}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleViewProject(p)} className="p-2 hover:bg-indigo-500/20 text-indigo-400 rounded-lg"><ChevronRight size={18} /></button>
                            <button onClick={() => handleDeleteProject(p.id!)} className="p-2 hover:bg-rose-500/20 text-rose-400 rounded-lg"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <AnimatePresence>{toast && <Toast message={toast.message} type={toast.type} />}</AnimatePresence>
    </div>
  );
}
