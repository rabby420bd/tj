import React from 'react';
import { Product } from '../types';
import { ShoppingBag } from 'lucide-react';

interface ProductCardProps {
    product: Product;
    onClick: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
    const isDiscounted = product.oldPrice && product.oldPrice > product.price;
    const discountPercentage = isDiscounted 
        ? ((1 - (product.price / (product.oldPrice || 1))) * 100).toFixed(0) 
        : 0;

    return (
        <div className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100 animate-slide-up flex flex-col h-full" onClick={onClick}>
            <div className="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer">
                {isDiscounted && (
                    <span className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md z-10">
                        -{discountPercentage}%
                    </span>
                )}
                <img 
                    src={product.images?.[0] || 'https://picsum.photos/400/400'} 
                    alt={product.name} 
                    className="w-full h-full object-cover transition duration-700 group-hover:scale-110" 
                />
                
                {/* Quick View Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="bg-white text-gray-900 text-sm font-semibold px-4 py-2 rounded-full shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                        View Details
                    </span>
                </div>
            </div>
            
            <div className="p-5 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-1">
                    <h3 className="text-base font-semibold text-gray-800 group-hover:text-primary transition-colors line-clamp-2">{product.name}</h3>
                </div>
                <span className="text-xs text-gray-500 mb-2 inline-block px-2 py-0.5 bg-gray-100 rounded-md self-start">{product.category}</span>
                
                <div className="mt-auto flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-900">৳{product.price.toLocaleString()}</span>
                        {isDiscounted && <span className="text-sm text-gray-400 line-through">৳{product.oldPrice?.toLocaleString()}</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductCard;