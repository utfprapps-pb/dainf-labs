package br.edu.utfpr.dainf.audit;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.List;

public class SystemAuthentication extends AbstractAuthenticationToken {

    public static final String SCHEDULER_PRINCIPAL = "SCHEDULER";

    private final UserDetails principal;

    public SystemAuthentication(String principalName) {
        super(List.of(new SimpleGrantedAuthority("ROLE_SYSTEM")));
        this.principal = User.withUsername(principalName)
                .password("")
                .authorities("ROLE_SYSTEM")
                .build();
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return null;
    }

    @Override
    public UserDetails getPrincipal() {
        return principal;
    }
}
