import { render, screen } from '@testing-library/react'
import Home from '../../pages/index'

// Mock Firebase auth context
jest.mock('../../contexts/UserContext', () => ({
  useUser: jest.fn(),
}))

// Mock Whiteboard and Chat components
jest.mock('../../components/Whiteboard', () => ({
  Whiteboard: () => <div data-testid="whiteboard">Whiteboard Component</div>
}))

jest.mock('../../components/Chat', () => ({
  Chat: () => <div data-testid="chat">Chat Component</div>
}))

// Mock firebase utils
jest.mock('../../shared/firebase', () => ({
  getStoredUid: () => 'test-uid-123'
}))

describe('Home Page', () => {
  const { useUser } = require('../../contexts/UserContext')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders loading state', () => {
    useUser.mockReturnValue({
      user: null,
      loading: true,
      error: null,
    })

    render(<Home />)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.getByText('Real-time Whiteboard')).toBeInTheDocument()
  })

  it('renders error state', () => {
    useUser.mockReturnValue({
      user: null,
      loading: false,
      error: 'Firebase connection failed',
    })

    render(<Home />)
    
    expect(screen.getByText('Error: Firebase connection failed')).toBeInTheDocument()
  })

  it('renders whiteboard and chat when user is authenticated', () => {
    useUser.mockReturnValue({
      user: { uid: 'test-user-123' },
      loading: false,
      error: null,
    })

    render(<Home />)
    
    expect(screen.getByText('Real-time Whiteboard')).toBeInTheDocument()
    expect(screen.getByTestId('whiteboard')).toBeInTheDocument()
    expect(screen.getByTestId('chat')).toBeInTheDocument()
    expect(screen.getByText('User: test-use...')).toBeInTheDocument()
  })

})
