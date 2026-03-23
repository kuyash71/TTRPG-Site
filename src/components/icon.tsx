import Image from "next/image";

type IconProps = {
  name: string;
  size?: number;
  className?: string;
  alt?: string;
};

export function Icon({ name, size = 20, className = "", alt = "" }: IconProps) {
  return (
    <Image
      src={`/icons/ui/${name}.svg`}
      alt={alt || name}
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
    />
  );
}
