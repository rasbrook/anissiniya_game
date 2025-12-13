import React, { useEffect } from "react";
import Balldisplay from "../components/balldisplay";
import gsap from "gsap";
import BlackjackView from "../components/blackjackview";
import Blackjackview from "../components/blackjackview";


const Blackjack = (props) => {

    useEffect(() => {
        // read CSS variables so the animation follows the current theme
        const root = getComputedStyle(document.documentElement);
        const accent = (root.getPropertyValue('--accent') || '#8CE4FF').trim();

        gsap.to("#ball", {
            x: 300,
            rotate: '100%',
            borderRadius: '100%',
            color: accent,
            yoyo: true,
            duration: 1,
            repeat: -1,
            ease: "power1.inOut",
            backgroundColor: accent
        });
    }, []);

    return (
        <div style={{ backgroundColor: 'var(--bg)' }}>
            <Blackjackview />



        </div>
    );
};

export default Blackjack;