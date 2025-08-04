import Head from 'next/head'
import { useUser } from '../contexts/UserContext'
import { useEffect, useState } from 'react'
import { getStoredUid } from '../shared/firebase'
import { Whiteboard } from '../components/Whiteboard'
import { Chat } from '../components/Chat'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { Tooltip } from '../components/Tooltip'

export default function Home() {
  const { user, loading, error } = useUser()
  const [storedUid, setStoredUid] = useState<string | null>(null)
  const [chatWidth, setChatWidth] = useState(320) // 320px = w-80
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    // Get stored UID from localStorage once component mounts
    setStoredUid(getStoredUid())
  }, [user])

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      
      const newWidth = window.innerWidth - e.clientX
      // Constrain width between 250px and 600px
      const constrainedWidth = Math.max(250, Math.min(600, newWidth))
      setChatWidth(constrainedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  if (loading) {
    return (
      <>
        <Head>
          <title>Real-time Whiteboard</title>
          <meta name="description" content="Collaborative whiteboard with chat" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <main>
          <h1>Real-time Whiteboard</h1>
          <p>Loading...</p>
        </main>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Head>
          <title>Real-time Whiteboard</title>
          <meta name="description" content="Collaborative whiteboard with chat" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <main>
          <h1>Real-time Whiteboard</h1>
          <p>Error: {error}</p>
        </main>
      </>
    )
  }

  return (
    <ErrorBoundary>
      <>
        <Head>
          <title>Real-time Whiteboard</title>
          <meta name="description" content="Collaborative whiteboard with chat" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
          <header className="flex justify-between items-center p-3 bg-white shadow-sm flex-shrink-0" style={{ borderBottom: '1px solid #fecdd3' }}>
            <h1 className="text-xl font-bold text-gray-900">FLR Whiteboard</h1>
            {user && (
              <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                <span>User: {user.uid.substring(0, 8)}...</span>
              </div>
            )}
          </header>
          
          {user && (
            <div className="flex-1 flex overflow-hidden">
              {/* Whiteboard Section - Left Side */}
              <div 
                className="bg-white overflow-hidden" 
                style={{ 
                  width: `calc(100% - ${chatWidth}px - 8px)`,
                  borderRight: '1px solid #fecdd3'
                }}
              >
                <ErrorBoundary>
                  <Whiteboard boardId="default-board" />
                </ErrorBoundary>
              </div>
              
              {/* Resize Handle */}
              <div
                className="w-2 hover:bg-pink-200 flex-shrink-0 transition-colors flex items-center justify-center bg-pink-50"
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsResizing(true)
                }}
                style={{
                  cursor: 'ew-resize',
                  borderLeft: '1px solid #fecdd3',
                  borderRight: '1px solid #fecdd3'
                }}
                title="Drag to resize chat window"
              >
                <div className="w-1 h-12 bg-pink-500 rounded-full" />
              </div>
              
              {/* Chat Section - Right Side */}
              <div 
                className="bg-white flex flex-col overflow-hidden"
                style={{ 
                  width: `${chatWidth}px`
                }}
              >
                <ErrorBoundary>
                  <Chat boardId="default-board" />
                </ErrorBoundary>
              </div>
            </div>
          )}
        </div>
      </>
    </ErrorBoundary>
  )
}
