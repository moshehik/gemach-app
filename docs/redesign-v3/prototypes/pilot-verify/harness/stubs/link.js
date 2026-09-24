import { forwardRef } from 'react';
const Link = forwardRef(function Link({ href, children, prefetch, ...rest }, ref) { return <a ref={ref} href={typeof href === 'string' ? href : '#'} {...rest}>{children}</a>; });
export default Link;
