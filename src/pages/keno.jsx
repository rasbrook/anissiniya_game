import React from "react";
import { backgroundColor, maincolor } from "../constants/color";
import { largeFontSize } from "../constants/fontsizes";
import KenoDisplay from "../components/kenodisplay";



const Keno = (props) => {

    return (
        <div style={{ backgroundColor: backgroundColor }}>



            <div>
                <KenoDisplay />


            </div>




        </div>
    );
};

export default Keno;