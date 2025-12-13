import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SupabaseHost } from '../../supabase.js'
import { useAuthStore } from '../store/authStore'

const SignInPage = () => {
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const navigate = useNavigate()
    const { setUser, isAuthenticated } = useAuthStore()

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/home')
        }
    }, [isAuthenticated, navigate])

    const fetchHost = async () => {
        let { data: host, error } = await SupabaseHost
            .from('host')
            .select("*")
            .eq('username', username)
            .eq('password', password)
        if (host && host.length > 0) {
            setUser(host[0].id)
            navigate('/home')
        } else {
            // invalid credentials - no string console log
        }
        //console.log(host)
        //console.log(error)
    }

    return (
        <div style={styles.main}>
            <input
                style={styles.input}
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            <input
                style={styles.input}
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={fetchHost}>Sign In</button>
        </div>
    )



}
const styles = {
    main: {
        background: 'var(--surface)',
        boxShadow: '0 12px 30px var(--card-shadow)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '100px',
        width: '300px',
        alignSelf: 'center',
        justifySelf: 'center',
        height: '300px',
        borderRadius: 10

    },
    input: {
        padding: '5px',
        marginTop: '5px',
        marginBottom: '5px',
        borderRadius: '5px',
        border: 'none',

    }
}

export default SignInPage
