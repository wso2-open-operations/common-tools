import type { SignatureData } from "../types";

interface Props {
  data: SignatureData;
  onChange: (data: SignatureData) => void;
}

export default function SignatureForm(_props: Props) {
  return <div>Form placeholder</div>;
}
