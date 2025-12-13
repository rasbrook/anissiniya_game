import React, { useState, useEffect } from "react";
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';
import { FaSun, FaMoon } from 'react-icons/fa';
import { applyTheme } from '../../theme'
import { useAuthStore } from '../../store/authStore'
// header styles moved to inline styles below (no external CSS)

const Header = (props) => {
    const nav = useNavigate()
    const { logout } = useAuthStore()
    const [isOpen, setIsOpen] = useState(false)
    const [theme, setTheme] = useState(() => {
        try {
            const saved = localStorage.getItem('app-theme');
            if (saved === 'dark' || saved === 'light') return saved;
            // fallback to system preference
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } catch (e) { return 'light'; }
    });

    useEffect(() => {
        // apply theme variables inline and persist
        try { applyTheme(theme); } catch (e) { /* ignore */ }
        try { localStorage.setItem('app-theme', theme); } catch (e) { }
    }, [theme]);

    const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 700 : false);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 700);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const styles = {
        main: {
            width: 'fit-content',
            minWidth: '100vw',
            maxWidth: '100vw',
            position: 'absolute',
            top: 0,
            left: 0,
            minHeight: '4em',
            display: 'flex',
            overflowX: 'hidden',
            justifyContent: 'space-between'
        },
        logoName: {
            display: 'flex',
            height: '80%',
            alignContent: 'center',
            maxWidth: '30%',
            alignSelf: 'center',
            position: 'relative',
            left: '5vw'
        },
        bigScreenNav: {
            width: 'fit-content',
            minWidth: '100vw',
            maxWidth: '100vw',
            position: 'absolute',
            top: 0,
            left: 0,
            height: '4em',
            display: 'flex',
            overflowY: 'hidden',
            justifyContent: 'space-between',
            alignItems: 'center'
        },
        smallScreenNav: {
            width: 'fit-content',
            minWidth: '100vw',
            position: 'absolute',
            top: 0,
            left: 0,
            height: '4em',
            display: 'flex',
            overflowX: 'visible',
            justifyContent: 'space-between',
            alignItems: 'center'
        },
        dropdown: {
            zIndex: 99999,
            width: '100vw',
            maxHeight: '80vh',
            overflowY: 'auto',
            position: 'fixed',
            left: 0
        }
    };

    {/*packages i should install
        framer-motion
         react-router-dom
         react-icons
         */}


    {/* what the props do to custumize them(rightCornerComponent linkstyleondrop linkstyleonbig dropdownstyle Topofdropdown Bottomofdropdown CompanyColor hovereffectonnav)
        backgroundcolor:background color of the whole header
    color: color of the text in the header  
    name: name of the company 
    CompanyColor: the unique color of the company 
    logo:image src of the logo of the company 
    pages: it is a list
    hovereffectonnav: the animation style of the header links when hovering over them 
    Topofdropdown: elements you want to add at the top of the dropdown
    Bottomofdropdown:elements you want to add at the top of the dropdown
    linkstyleondrop: the style of the links in the dropdown header 
    linkstyleonbig: the style of the links in the header in big screen
    middleelement:any element you want to add to the middle of the header like search
    rightCornerComponent:any component you want to add the the right corner of the big screen header
    dropdownstyle: to style the dropdown of the header
    */ }

    {/* example
        <Header
                rightCornerComponent={<div style={{ height: '100%', alignContent: 'center', marginRight: 20 }}><button style={{ backgroundColor: 'var(--secondary)' }}>Click Me</button></div>}
                linkstyleondrop={{ fontSize: 24 }}
                linkstyleonbig={{ fontSize: 20 }}
                dropdownstyle={{ justifyContent: 'center', justifyItems: 'center', backgroundColor: 'var(--accent)' }}
                Topofdropdown={<button>hola</button>}
                Bottomofdropdown={<button style={{ textAlign: 'center' }}>hello</button>}
                CompanyColor={'var(--secondary)'} 
                logo={l} 
                pages={['Home', "About", "Contact", 'Donate']}
                hovereffectonnav={{ color: 'var(--accent)', scale: 1.4, fontWeight: 600 }} />
        
        */}


    return (
        <motion.div id='main' style={{ ...styles.main, ...props.mainstyle, background: props.backgroundcolor || 'var(--surface)', color: props.color || 'var(--text)', overflowY: 'auto', overflowX: 'hidden' }}>


            <motion.div style={{ ...styles.bigScreenNav, display: isMobile ? 'none' : 'flex' }}>
                <motion.div id="logo-name" style={styles.logoName} whileHover={{ cursor: 'pointer' }} onTap={() => { nav('/') }}>
                    {/*logo and name*/}
                    <motion.img style={{ ...props.logostyle }} src={props.logo} />
                    <motion.h2 style={{ fontSize: 18, marginLeft: '2vw', textAlign: 'center', color: props.CompanyColor || 'var(--secondary)' }}>
                        {props.name || 'Name'}
                    </motion.h2>


                </motion.div>


                <motion.div style={{ display: 'flex', gap: 30, alignItems: 'center' }}>
                    {!props.bigmiddleelement ?
                        props.pages ? props.pages.map((p) => (
                            <motion.div key={p} onClick={() => nav(`${p}`)} style={{ ...props.linkstyleonbig, marginRight: 10, color: props.color || 'var(--text)' }} transition={{ type: 'tween' }} whileHover={{ ...props.hovereffectonnav, cursor: 'pointer' }} >
                                <p style={{ ...props.linkstyleonbig }}>
                                    {p}
                                </p>

                            </motion.div>

                        )) :
                            <></> : props.bigmiddleelement
                    }

                </motion.div>


                {props.rightCornerComponent}

                {/* Theme toggle */}
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: 12 }}>
                    <button aria-label="Toggle theme" onClick={toggleTheme} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6 }}>
                        {theme === 'dark' ? <FaSun size={18} color={'var(--accent)'} /> : <FaMoon size={18} color={'var(--accent)'} />}
                    </button>
                    <button onClick={() => { logout(); nav('/') }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, marginLeft: 10, color: 'var(--text)' }}>
                        Logout
                    </button>
                </div>


            </motion.div>




            {/*Small Screen */}


            <motion.div style={{ ...styles.smallScreenNav, display: isMobile ? 'flex' : 'none' }}>
                <motion.div style={{ alignContent: 'center' }}>
                    <motion.img onTap={() => { nav('/') }} src={props.logo} style={{ height: '75%', marginLeft: 20 }} />

                </motion.div>

                {props.middleelement}

                <motion.div style={{ alignContent: 'center', marginRight: 30 }}>

                    {isOpen ? <FaTimes size={35} onTouchEnd={() => { setIsOpen(!isOpen) }} color={props.CompanyColor || 'var(--secondary)'} /> :
                        <FaBars size={35} onTouchEnd={() => { setIsOpen(!isOpen) }} color={props.CompanyColor || 'var(--secondary)'} />
                    }


                </motion.div>

                {isOpen ? <motion.div
                    style={{ ...props.dropdownstyle, ...styles.dropdown, top: '-100vh', width: '100vw' }}
                    initial={{ opacity: 0, top: '-50vh' }}
                    animate={{ opacity: 1, top: '3.9em' }}
                    exit={{ opacity: 0, top: '-50vh' }}
                    transition={{ duration: 0.5 }}
                >
                    {props.Topofdropdown}

                    {props.pages ? props.pages.map((p) => (
                        <motion.div key={p} onClick={() => { nav(`${p}`); setIsOpen(false); }} style={{ ...props.linkstyle, margin: 10, color: props.color || 'var(--text)', marginLeft: 20 }} transition={{ type: 'tween' }} whileHover={{ ...props.hovereffectonnav, cursor: 'pointer' }}>
                            <p style={{
                                ...props.linkstyleondrop
                            }}>
                                {p}
                            </p>
                        </motion.div>
                    )) : <></>}

                    {props.Bottomofdropdown}

                    {/* mobile theme toggle */}
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
                        <button aria-label="Toggle theme" onClick={toggleTheme} style={{ background: 'transparent', border: '1px solid var(--card-border)', borderRadius: 8, padding: 8, cursor: 'pointer' }}>
                            {theme === 'dark' ? <FaSun size={16} color={'var(--accent)'} /> : <FaMoon size={16} color={'var(--accent)'} />}
                        </button>
                    </div>


                </motion.div> : <></>}


            </motion.div>

        </motion.div>
    );
};

export default Header;


