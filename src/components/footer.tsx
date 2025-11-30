import { FaGithub, FaLinkedinIn, FaNpm } from "react-icons/fa";
import { SiPypi } from "react-icons/si";

export const Footer = () => {
  return (
    <footer className="border-t flex-shrink-0 px-4 py-2 text-xs flex items-center gap-2">
      <span>
        Powered by{" "}
        <a
          href="https://github.com/iamtemi/schemabridge"
          className="underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          SchemaBridge
        </a>
      </span>

      {" | "}
      <a
        href="https://www.npmjs.com/package/schemabridge"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-red-500"
      >
        <FaNpm className="w-4 h-4" />
      </a>
      <a
        href="https://pypi.org/project/schemabridge/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-yellow-500"
      >
        <SiPypi className="w-4 h-4" />
      </a>
      <a
        href="https://github.com/iamtemi "
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-gray-500"
      >
        <FaGithub className="w-4 h-4" />
      </a>
      <a
        href="https://www.linkedin.com/in/temi-adenuga/"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-blue-500"
      >
        <FaLinkedinIn className="w-4 h-4" />
      </a>
    </footer>
  );
};
