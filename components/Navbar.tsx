
import React, { useState, useEffect } from 'react';
import { ShoppingBag, Menu, X, Search } from 'lucide-react';
import { CartItem } from '../types';

interface NavbarProps {
    cartCount: number;
    onNavigate: (page: string) => void;
}

const Navbar: React.FC<NavbarProps> = ({ cartCount, onNavigate }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [animateCart, setAnimateCart] = useState(false);

    // Trigger animation when cartCount changes
    useEffect(() => {
        if (cartCount > 0) {
            setAnimateCart(true);
            const timer = setTimeout(() => setAnimateCart(false), 500); // Matches wiggle duration
            return () => clearTimeout(timer);
        }
    }, [cartCount]);

    const handleSearchClick = () => {
        onNavigate('home');
        setTimeout(() => {
            const searchInput = document.getElementById('product-search');
            if (searchInput) {
                searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                searchInput.focus();
            }
        }, 300);
        setMobileMenuOpen(false);
    };

    return (
        <header className="fixed w-full top-0 z-50 glass transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    
                    {/* Logo */}
                    <div onClick={() => onNavigate('home')} className="cursor-pointer group flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary text-white flex items-center justify-center font-serif font-bold text-2xl rounded-lg shadow-lg group-hover:rotate-3 transition-transform">T</div>
                        <div className="flex flex-col">
                            <span className="font-serif font-black text-xl tracking-widest text-gray-900 leading-none group-hover:text-primary transition-colors">TRENDY</span>
                            <span className="text-[10px] tracking-[0.3em] text-gray-500 uppercase">Jamakapor</span>
                        </div>
                    </div>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center space-x-6">
                        <button onClick={() => onNavigate('home')} className="text-sm font-medium text-gray-700 hover:text-primary transition-colors uppercase tracking-wide">Shop</button>
                        <button onClick={() => onNavigate('track')} className="text-sm font-medium text-gray-700 hover:text-primary transition-colors uppercase tracking-wide">Track Order</button>
                        
                        <div className="h-6 w-px bg-gray-200 mx-2"></div>

                        {/* Search Icon */}
                        <button onClick={handleSearchClick} className="text-gray-700 hover:text-primary transition-colors p-1" aria-label="Search">
                            <Search className="h-6 w-6" />
                        </button>
                        
                        <button 
                            onClick={() => onNavigate('checkout')} 
                            className={`relative p-2 text-gray-700 hover:text-primary transition-colors group ${animateCart ? 'animate-wiggle' : ''}`}
                        >
                            <ShoppingBag className="h-6 w-6" />
                            {cartCount > 0 && (
                                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 w-5 text-xs font-bold text-white bg-red-600 rounded-full">
                                    {cartCount}
                                </span>
                            )}
                        </button>
                    </nav>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center gap-3">
                        <button onClick={handleSearchClick} className="text-gray-700 hover:text-primary transition-colors p-2">
                            <Search className="h-6 w-6" />
                        </button>

                        <button 
                            onClick={() => onNavigate('checkout')} 
                            className={`relative text-gray-700 p-2 ${animateCart ? 'animate-wiggle' : ''}`}
                        >
                            <ShoppingBag className="h-6 w-6" />
                            {cartCount > 0 && (
                                <span className="absolute top-0 right-0 inline-flex items-center justify-center h-4 w-4 text-[10px] font-bold text-white bg-red-600 rounded-full">
                                    {cartCount}
                                </span>
                            )}
                        </button>
                        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-700 focus:outline-none p-2">
                            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
                <div className="md:hidden bg-white border-t border-gray-100 absolute w-full shadow-lg animate-slide-up">
                    <div className="px-4 pt-2 pb-6 space-y-1">
                        <button onClick={() => { onNavigate('home'); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-4 text-base font-medium text-gray-900 border-b border-gray-50">Home</button>
                        <button onClick={() => { onNavigate('track'); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-4 text-base font-medium text-gray-900 border-b border-gray-50">Track Order</button>
                        <button onClick={() => { onNavigate('admin'); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-4 text-sm text-gray-500">Admin Login</button>
                    </div>
                </div>
            )}
        </header>
    );
};

export default Navbar;
