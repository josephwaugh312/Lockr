import { render } from '@testing-library/react'
import SignInRedirect from './page'
import { useRouter } from 'next/navigation'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

describe('SignIn redirect page', () => {
  it('redirects to /authentication/signin on mount', () => {
    const replace = jest.fn()
    ;(useRouter as jest.Mock).mockReturnValue({ replace })
    render(<SignInRedirect />)
    expect(replace).toHaveBeenCalledWith('/authentication/signin')
  })
})