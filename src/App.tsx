import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'
import Button from './components/button'
import SidebarNav from './components/sidebarnav'
import { FaPlus, FaRegTrashAlt  } from 'react-icons/fa'
import { Md7kPlus } from 'react-icons/md'


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <SidebarNav></SidebarNav>
      <div className='page'>
        <Button text="Add to Counter" onClick={() => setCount((count) => count + 1)} icon={FaPlus} bold size="1.5rem" aria="Add to counter" />
        <Button text="Delete something" onClick={() => setCount((count) => count - 1)} icon={FaRegTrashAlt } colour='#e24242' aria="Delete item" />
        <Button text="Add big" onClick={() => setCount((count) => count + 7000)} icon={Md7kPlus} colour='#0b3a0f' size="2.5rem" aria="Add large amount" />
      </div>
      
    </>
  )
}

export default App
