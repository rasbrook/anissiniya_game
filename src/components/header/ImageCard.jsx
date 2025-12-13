import { motion } from 'framer-motion';

const ImageCard = ({ imageUrl, altText, onClick, style, animation }) => {
    // Default animations
    const defaultVariants = {
        initial: { opacity: 0, scale: 0.9 },
        animate: {
            opacity: 1,
            scale: 1,
            transition: { duration: 0.5, ease: "easeOut" }
        },
        hover: {
            scale: 1.03,
            transition: { duration: 0.3 }
        },
        tap: {
            scale: 0.95
        }
    };

    // Merging default with custom animations
    const variants = animation ? { ...defaultVariants, ...animation } : defaultVariants;

    // Inline styles
    const styles = {
        container: {
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '12px',
            cursor: 'pointer',
            width: '100%',
            maxWidth: '400px',
            aspectRatio: '16/9',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            ...style
        },
        image: {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            backgroundColor: '#f5f5f5'
        }
    };

    return (
        <motion.div
            style={styles.container}
            variants={variants}
            initial="initial"
            animate="animate"
            whileHover="hover"
            whileTap="tap"
            onClick={onClick}
        >
            <motion.img
                src={imageUrl}
                alt={altText}
                style={styles.image}
                transition={{ duration: 0.3 }}
            />
        </motion.div>
    );
};

export default ImageCard;