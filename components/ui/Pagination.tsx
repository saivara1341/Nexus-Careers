import React from 'react';
import { Button } from './Button.tsx';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) {
        return null;
    }

    return (
        <div className="flex justify-end items-center gap-4 mt-4">
            <span className="text-text-muted">
                Page {currentPage} of {totalPages}
            </span>
            <Button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Go to previous page"
                 className="text-sm py-1 px-3"
            >
                Previous
            </Button>
            <Button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Go to next page"
                className="text-sm py-1 px-3"
            >
                Next
            </Button>
        </div>
    );
};