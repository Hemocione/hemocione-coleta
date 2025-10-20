/**
 * Generate a consistent color for user avatars based on their name
 * This ensures the same user always gets the same color
 */
export function generateAvatarColor(name: string): string {
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  // Use absolute value and modulo to get a positive number
  const normalizedHash = Math.abs(hash) % 360;

  // Generate HSL color with fixed saturation and lightness for consistency
  return `hsl(${normalizedHash}, 70%, 50%)`;
}

/**
 * Generate user initials from full name
 */
export function generateInitials(firstName: string, lastName: string): string {
  const firstInitial = firstName?.charAt(0)?.toUpperCase() || "";
  const lastInitial = lastName?.charAt(0)?.toUpperCase() || "";
  return `${firstInitial}${lastInitial}`;
}
