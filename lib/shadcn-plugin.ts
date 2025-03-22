import plugin from 'tailwindcss/plugin';

export const shadcnPlugin = plugin(
  // Add variants
  ({ addVariant }) => {
    // Add open variant for radix-ui components
    addVariant('open', '&[data-state="open"]');
    addVariant('closed', '&[data-state="closed"]');
    
    // Add checked/selected variants
    addVariant('checked', '&[data-state="checked"]');
    addVariant('unchecked', '&[data-state="unchecked"]');
    addVariant('selected', '&[data-state="selected"]');
    
    // Add size variants
    addVariant('sm', '&[data-size="sm"]');
    addVariant('md', '&[data-size="md"]');
    addVariant('lg', '&[data-size="lg"]');
    
    // Add highlighting variant 
    addVariant('highlighted', '&[data-highlighted]');
    
    // Add state variants
    addVariant('active', '&[data-active]');
    addVariant('inactive', '&:not([data-active])');
  },
);
