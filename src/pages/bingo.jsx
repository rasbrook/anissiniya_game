import React from "react";
import { backgroundColor, maincolor } from "../constants/color";
import { largeFontSize } from "../constants/fontsizes";
import Balldisplay from "../components/balldisplay";


const Bingo = (props) => {

    return (
        <div style={{ backgroundColor: backgroundColor }}>



            <div>
                <Balldisplay />


            </div>




        </div>
    );
};

export default Bingo;