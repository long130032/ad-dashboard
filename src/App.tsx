import { Route, Routes } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { Overview } from './pages/Overview'
import { Projects } from './pages/Projects'
import { Media } from './pages/Media'
import { Team } from './pages/Team'
import { Accounts } from './pages/Accounts'
import { Detail } from './pages/Detail'
import { DataImport } from './pages/DataImport'
import { Config } from './pages/Config'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="projects" element={<Projects />} />
        <Route path="media" element={<Media />} />
        <Route path="team" element={<Team />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="detail" element={<Detail />} />
        <Route path="import" element={<DataImport />} />
        <Route path="config" element={<Config />} />
      </Route>
    </Routes>
  )
}
