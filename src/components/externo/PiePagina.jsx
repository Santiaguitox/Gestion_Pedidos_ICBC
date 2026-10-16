import icommLogo from '../../assets/Icomm_Logo.png'

export default function PiePagina() {
  return (
    <footer className="ex-pie">
      <span className="ex-pie__pastilla">
        Powered by
        <img className="ex-pie__logo" src={icommLogo} alt="icomm" />
      </span>
    </footer>
  )
}
