import { WorkspaceView } from './components/WorkspaceView'
import { useRepositoryWorkspace } from './hooks/useRepositoryWorkspace'

function App(): React.JSX.Element {
  const workspace = useRepositoryWorkspace()
  return <WorkspaceView {...workspace} />
}

export default App
