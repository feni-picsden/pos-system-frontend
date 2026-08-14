// Revision rows carry typed JSON (Prisma Json? columns), so `value || "-"` is wrong:
// boolean false and number 0 are meaningful, and a raw boolean is not a React child.
export const formatRevisionValue = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export default formatRevisionValue;
